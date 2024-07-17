import { defineStore } from 'pinia'

export const useEventStore = defineStore('eventStore', {
  state: () => ({
    event: null,
    selectedCategories: [],
    selectedCategory: null,
    events: [],
    eventName: '',
    eventType: '',
    eventDate: '',
    eventLocation: {
      address: '',
      coordinates: { lat: null, lng: null },
      postalCode: '',
      mapImageUrl: ''
    },
    eventPrice: 0,
    isFree: false,
    eventCapacity: 0,
    eventDescription: '',
    startTime: '',
    endTime: '',
    externalUrl: '',
    eventImg: '',
    selectedFile: null,
    mapCenter: { lat: 51.09, lng: 6.84 },
    hasTriedSubmit: false,
    googleMapsApiKey: null
  }),
  actions: {
    setEvent(eventData) {
      this.event = eventData
    },
    toggleCategory(category) {
      const index = this.selectedCategories.findIndex(c => c._id === category._id)
      if (index === -1) {
        this.selectedCategories.push(category)
      } else {
        this.selectedCategories.splice(index, 1)
      }
    },
    setPlaceDetails(place) {
      this.eventLocation.address = place.formatted_address
      this.eventLocation.coordinates = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      }
      const postalCodeComponent = place.address_components.find(component => component.types.includes('postal_code'))
      this.eventLocation.postalCode = postalCodeComponent ? postalCodeComponent.long_name : ''
      this.eventLocation.mapImageUrl = this.generateMapImageUrl(
        place.geometry.location.lat(), 
        place.geometry.location.lng()
      )
      this.externalUrl = place.website
    },
    setMapCenter(lat, lng) {
      this.mapCenter = { lat, lng }
    },
    setMapImageUrl(lat, lng) {
      this.eventLocation.mapImageUrl = this.generateMapImageUrl(lat, lng)
    },
    setHasTriedSubmit(value) {
      this.hasTriedSubmit = value
    },
    setEvents(events) {
      this.events = events
    },
    setGoogleMapsApiKey(key) {
      this.googleMapsApiKey = key
    },
    generateMapImageUrl(lat, lng) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${this.googleMapsApiKey}`
    }
  }
})