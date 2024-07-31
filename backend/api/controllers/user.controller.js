const User = require('../models/user.model')
const Company = require('../models/company.model')
const Subscription = require('../models/subscription.model')

const createUser = async (req, res) => {
  try {
    let newUser
    const { role, ...userData } = req.body

    if (role === 'company') {
      if (!userData.companyName || !userData.phone || !userData.sector) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for company user.',
        })
      }
      // Si no se proporciona companyEmail, usamos el email principal
      if (!userData.companyEmail) {
        userData.companyEmail = userData.email
      }
      // Verificar si ya existe una compañía con el mismo companyEmail
      const existingCompany = await Company.findOne({
        companyEmail: userData.companyEmail,
      })
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'A company with this email already exists.',
        })
      }

      newUser = await Company.create({ ...userData, role })
    } else {
      newUser = await User.create({ ...userData, role })
    }

    res.status(201).json({
      success: true,
      message: 'User successfully created.',
      result: newUser,
    })
  } catch (error) {
    console.error(error)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email or company email already exists.',
        description: error.message,
      })
    }
    return res.status(500).json({
      success: false,
      message: 'Error creating user.',
      description: error.message,
    })
  }
}

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().lean()

    const populatedUsers = await Promise.all(
      users.map(async (user) => {
        if (user.subscription) {
          user.subscription = await Subscription.findById(user.subscription)
        }
        return user
      })
    )
    res.status(200).json({
      success: true,
      message: 'Users succesfully fetched.',
      result: populatedUsers,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting users.',
      description: error.message,
    })
  }
}

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }
    res.status(200).json({
      success: true,
      message: 'User successfully fetched.',
      result: user,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Error getting user.',
      description: error.message,
    })
  }
}

const getCurrentUser = async (req, res) => {
  try {
    const { email } = req.params
    console.log('Email received:', email)
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }
    res.status(200).json({
      success: true,
      message: 'User successfully fetched.',
      result: user,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Error getting current user.',
      description: error.message,
    })
  }
}

const updateUser = async (req, res) => {
  try {
    let user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const oldRole = user.role
    const newRole = req.body.role

    if (newRole === 'company' && oldRole !== 'company') {
      // Cambio a company
      const companyData = { ...user.toObject(), ...req.body }
      await User.findByIdAndDelete(req.params.id)
      user = await Company.create(companyData)
    } else if (newRole !== 'company' && oldRole === 'company') {
      // Cambio de company a otro rol
      const userData = { ...user.toObject(), ...req.body }
      await Company.findByIdAndDelete(req.params.id)
      user = await User.create(userData)
    } else if (newRole === 'company' && oldRole === 'company') {
      // Actualización de company
      user = await Company.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
    } else {
      // Actualización de usuario regular
      Object.assign(user, req.body)
      await user.save()
    }
    // Populate the subscription
    await user.populate('subscription')

    res.status(200).json({
      success: true,
      message: 'User successfully updated.',
      result: user,
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating user.',
      description: error.message,
    })
  }
}

const updateUserSubscription = async (req, res) => {
  try {
    const userId = req.params.id
    const { subscriptionId } = req.body

    let user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    if (user.role !== 'company') {
      return res.status(400).json({
        success: false,
        message: 'Only company users can have subscriptions',
      })
    }

    user = await Company.findByIdAndUpdate(
      userId,
      { subscription: subscriptionId },
      { new: true, runValidators: true }
    ).populate('subscription')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Company user not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'User subscription successfully updated.',
      result: user,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Error updating user subscription.',
      description: error.message,
    })
  }
}

// Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      })
    }
    res.status(200).json({
      success: true,
      message: 'User successfully deleted.',
      result: user,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Error deleting user.',
      description: error.message,
    })
  }
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  updateUserSubscription,
  deleteUser,
}