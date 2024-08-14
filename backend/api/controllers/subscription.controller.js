const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const Company = require('../models/company.model')
const Subscription = require('../models/subscription.model')
const { createStripeCustomer } = require('../services/stripeService')

const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
    res.status(200).json({
      success: true,
      message: 'Subscriptions successfully fetched.',
      result: subscriptions,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      message: 'Error getting subscriptions.',
      description: error.message,
    })
  }
}

const createSubscription = async (req, res) => {
  try {
    const { userId, email, planId } = req.body

    // Buscar la compañía
    const company = await Company.findById(userId)
    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    let customer
    if (company.stripe && company.stripe.customerId) {
      customer = await stripe.customers.retrieve(company.stripe.customerId)
    } else {
      customer = await createStripeCustomer(userId, email)
    }

    // Crear una sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // success_url: `${process.env.BASE_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      // cancel_url: `${process.env.BASE_URL}/subscription/canceled`,
    })

    // Guardar el subscriptionId en la base de datos
    company.stripe.subscriptionId = session.subscription
    await company.save()

    res.status(200).json({ sessionId: session.id })
  } catch (error) {
    console.error('Error creating subscription:', error)
    res.status(500).json({ error: 'Error creating subscription' })
  }
}

const cancelSubscription = async (req, res) => {
  const { companyId } = req.params

  try {
    const company = await Company.findById(companyId)

    if (!company || !company.stripe.subscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' })
    }

    const stripeSubscriptionId = company.stripe.subscriptionId

    // Cancelar la suscripción en Stripe al final del período actual
    const canceledSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    )

    // Actualizar el estado de la suscripción en nuestra base de datos
    company.activeSubscription.status = 'canceling'
    company.activeSubscription.cancelAtPeriodEnd = true
    company.activeSubscription.canceledAt = new Date()

    await company.save()

    res.json({
      message:
        'Subscription scheduled for cancellation at the end of the current period',
      cancelDate: new Date(canceledSubscription.current_period_end * 1000),
    })
  } catch (error) {
    console.error('Error canceling subscription:', error)
    res.status(500).json({ error: 'Error canceling subscription' })
  }
}

const reactivateSubscription = async (req, res) => {
  const { companyId } = req.params

  try {
    const company = await Company.findById(companyId)

    if (!company || !company.stripe.subscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' })
    }

    const stripeSubscriptionId = company.stripe.subscriptionId

    // Reactivar la suscripción en Stripe
    const reactivatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    )

    // Actualizar el estado de la suscripción en nuestra base de datos
    company.activeSubscription.status = 'active'
    company.activeSubscription.cancelAtPeriodEnd = false
    company.activeSubscription.canceledAt = null

    await company.save()

    res.json({
      message: 'Subscription reactivated successfully',
      subscription: reactivatedSubscription,
    })
  } catch (error) {
    console.error('Error reactivating subscription:', error)
    res.status(500).json({ error: 'Error reactivating subscription' })
  }
}

const upgradeSubscription = async (req, res) => {
  const { companyId } = req.params
  const { newPlanId } = req.body

  try {
    const company = await Company.findById(companyId)

    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verificar si existe una suscripción activa en Stripe
    let stripeSubscription
    if (company.stripe && company.stripe.customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: company.stripe.customerId,
        status: 'active',
        limit: 1,
      })

      if (subscriptions.data.length > 0) {
        stripeSubscription = subscriptions.data[0]
      }
    }

    if (!stripeSubscription) {
      // If no active subscription, create a new one
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: newPlanId, quantity: 1 }],
        after_completion: { type: 'redirect', redirect: { url: `${process.env.BASE_URL}subscription/success` } },
      })


      return res.json({
        success: true,
        message: 'Payment link created for new subscription',
        paymentLink: paymentLink.url,
      })
    } else {
      // Caso 2: El usuario tiene una suscripción activa
      const updatedSubscription = await stripe.subscriptions.update(
        stripeSubscription.id,
        {
          items: [{ id: stripeSubscription.items.data[0].id, price: newPlanId }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
        }
      )

      // Actualizar la información del usuario
      company.activeSubscription = {
        status: 'active',
        plan: newPlanId,
        currentPeriodStart: new Date(
          updatedSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
      }
      company.stripe.subscriptionId = updatedSubscription.id
      company.stripe.subscriptionItemId = updatedSubscription.items.data[0].id
      await company.save()
  
      res.json({
        success: true,
        message: 'Subscription upgraded successfully',
        subscription: updatedSubscription,
      })
    }
  } catch (error) {
    console.error('Error upgrading subscription:', error)
    res.status(500).json({
      success: false,
      error: 'Error upgrading subscription',
      message: error.message
    })
  }
}

const updateExpiredSubscriptions = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    const expiredCompanies = await Company.find({
      'activeSubscription.currentPeriodEnd': { $lte: today },
      'activeSubscription.status': { $in: ['active', 'canceling'] },
    })

    for (const company of expiredCompanies) {
      company.activeSubscription.status = 'canceled'
      company.role = 'basic'
      await company.save()
      console.log(
        `Company ${company._id} subscription expired and role set to basic`
      )
    }
  } catch (error) {
    console.error('Error updating expired subscriptions:', error)
  }
}

module.exports = {
  getSubscriptions,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  upgradeSubscription,
  updateExpiredSubscriptions,
}