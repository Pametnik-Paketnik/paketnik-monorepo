import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, User, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Edit, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// User type enum to match backend
enum UserType {
  USER = 'USER',
  HOST = 'HOST',
}

// Reservation status enum to match backend
enum ReservationStatus {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
}

interface User {
  id: number
  name: string
  surname: string
  email: string
  userType: UserType
  totpEnabled: boolean
  faceEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface Box {
  boxId: string
  location: string | null
  pricePerNight: string | number
}

interface Reservation {
  id: string
  box: Box
  guest: User
  host: User
  checkinAt: string
  checkoutAt: string
  actualCheckinAt?: string
  actualCheckoutAt?: string
  status: ReservationStatus
  totalPrice?: number
}

interface ExtraOrderItem {
  inventoryItemId: number
  quantity: number
  name?: string
}

interface ExtraOrder {
  id: number
  reservationId: number
  items: ExtraOrderItem[]
  notes: string
  status: string
  createdAt: string
}

interface InventoryItem {
  id: number
  name: string
  quantity: number
  price: number
}

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const user = useSelector((state: RootState) => state.auth.user)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBoxDialogOpen, setIsBoxDialogOpen] = useState(false)
  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([])
  const [selectedBoxId, setSelectedBoxId] = useState<string>('')
  const [editedDates, setEditedDates] = useState({
    checkinAt: '',
    checkoutAt: '',
  })
  const [extraOrders, setExtraOrders] = useState<ExtraOrder[]>([])
  const [loadingExtraOrders, setLoadingExtraOrders] = useState(false)
  const [isAddExtraOrderOpen, setIsAddExtraOrderOpen] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [newOrder, setNewOrder] = useState<{ items: { inventoryItemId: number; quantity: number }[]; notes: string }>({ items: [], notes: '' })

  useEffect(() => {
    const fetchReservation = async () => {
      if (!id || !token) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch reservation')
        }

        const data = await response.json()
        setReservation(data)
      } catch (err) {
        console.error('Error fetching reservation:', err)
        setError(err instanceof Error ? err.message : 'Failed to load reservation')
      } finally {
        setLoading(false)
      }
    }

    fetchReservation()
  }, [id, token])

  // Initialize edit form with current reservation dates when dialog opens
  useEffect(() => {
    if (reservation && isEditDialogOpen) {
      setEditedDates({
        checkinAt: new Date(reservation.checkinAt).toISOString().slice(0, 16),
        checkoutAt: new Date(reservation.checkoutAt).toISOString().slice(0, 16),
      })
    }
  }, [reservation, isEditDialogOpen])

  // Fetch extra orders for this reservation
  useEffect(() => {
    const fetchExtraOrders = async () => {
      if (!id || !token) return
      setLoadingExtraOrders(true)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/extra-orders/reservation/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Failed to fetch extra orders')
        const data = await response.json()
        setExtraOrders(data)
      } catch (error) {
        console.error('Error fetching extra orders:', error)
        setExtraOrders([])
      } finally {
        setLoadingExtraOrders(false)
      }
    }
    fetchExtraOrders()
  }, [id, token])

  // Fetch inventory items for the order form
  useEffect(() => {
    const fetchInventory = async () => {
      if (!token) return
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Failed to fetch inventory items')
        const data = await response.json()
        setInventoryItems(data)
      } catch (error) {
        console.error('Error fetching inventory items:', error)
        toast.error('Failed to fetch inventory items')
      }
    }
    if (isAddExtraOrderOpen) fetchInventory()
  }, [isAddExtraOrderOpen, token])

  const getStatusIcon = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.PENDING:
        return <Clock className="h-4 w-4" />
      case ReservationStatus.CHECKED_IN:
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case ReservationStatus.CHECKED_OUT:
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case ReservationStatus.CANCELLED:
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case ReservationStatus.CHECKED_IN:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case ReservationStatus.CHECKED_OUT:
        return 'bg-green-100 text-green-800 border-green-200'
      case ReservationStatus.CANCELLED:
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatPrice = (price: number | string | undefined): string => {
    if (!price) return '0.00'
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)
  }

  const isHost = user?.userType === UserType.HOST

  const calculateNightsAndPrice = (checkinAt: string, checkoutAt: string, pricePerNight: number | string) => {
    const nights = Math.ceil((new Date(checkoutAt).getTime() - new Date(checkinAt).getTime()) / (1000 * 60 * 60 * 24))
    const price = typeof pricePerNight === 'string' ? parseFloat(pricePerNight) : pricePerNight
    const totalPrice = nights * price
    return { nights, totalPrice }
  }

  const handleEditReservation = async () => {
    if (!id || !token || !reservation) return

    try {
      // Validate dates
      if (!editedDates.checkinAt || !editedDates.checkoutAt) {
        toast.error('Please select both check-in and check-out dates')
        return
      }

      const checkinDate = new Date(editedDates.checkinAt)
      const checkoutDate = new Date(editedDates.checkoutAt)

      if (checkinDate >= checkoutDate) {
        toast.error('Check-out date must be after check-in date')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkinAt: editedDates.checkinAt,
          checkoutAt: editedDates.checkoutAt,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to update reservation')
      }

      const updatedReservation = await response.json()

      // Recalculate total price after update
      const { totalPrice } = calculateNightsAndPrice(updatedReservation.checkinAt, updatedReservation.checkoutAt, updatedReservation.box.pricePerNight)

      // Update the reservation with the calculated price
      setReservation({
        ...updatedReservation,
        totalPrice,
      })

      setIsEditDialogOpen(false)
      toast.success('Reservation updated successfully')
    } catch (err) {
      console.error('Error updating reservation:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update reservation')
    }
  }

  const handleDeleteReservation = async () => {
    if (!id || !token) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete reservation')
      }

      toast.success('Reservation deleted successfully')
      navigate('/reservations')
    } catch (err) {
      console.error('Error deleting reservation:', err)
      toast.error('Failed to delete reservation')
    }
  }

  const handleStatusChange = async (newStatus: ReservationStatus) => {
    if (!id || !token) return

    try {
      let response
      if (newStatus === ReservationStatus.CANCELLED) {
        // Use the cancel endpoint
        response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reservationId: parseInt(id, 10) }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.message || 'Failed to cancel reservation')
        }
      } else {
        // Use the status endpoint for other status changes
        response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/${id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.message || 'Failed to update reservation status')
        }
      }

      const updatedReservation = await response.json()
      setReservation(updatedReservation)
      toast.success(newStatus === ReservationStatus.CANCELLED ? 'Reservation cancelled successfully' : 'Reservation status updated successfully')
    } catch (err) {
      console.error('Error updating reservation status:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update reservation status')
    }
  }

  // Add function to fetch available boxes
  const fetchAvailableBoxes = async () => {
    if (!token) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/boxes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch boxes')
      }

      const data = await response.json()
      setAvailableBoxes(data)
    } catch (err) {
      console.error('Error fetching boxes:', err)
      toast.error('Failed to fetch available boxes')
    }
  }

  // Add function to handle box change
  const handleBoxChange = async () => {
    if (!id || !token || !selectedBoxId) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reservations/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ boxId: selectedBoxId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to update box')
      }

      const updatedReservation = await response.json()

      // Recalculate total price after box change
      const { totalPrice } = calculateNightsAndPrice(updatedReservation.checkinAt, updatedReservation.checkoutAt, updatedReservation.box.pricePerNight)

      // Update the reservation with the calculated price
      setReservation({
        ...updatedReservation,
        totalPrice,
      })

      setIsBoxDialogOpen(false)
      toast.success('Box updated successfully')
    } catch (err) {
      console.error('Error updating box:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update box')
    }
  }

  const handleAddExtraOrder = async () => {
    if (!id || !token) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/extra-orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: parseInt(id, 10),
          items: newOrder.items,
          notes: newOrder.notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to create extra order')
      }

      const createdOrder = await response.json()
      setExtraOrders((prev) => [...prev, createdOrder])
      setIsAddExtraOrderOpen(false)
      setNewOrder({ items: [], notes: '' })
      toast.success('Extra order created successfully')
    } catch (err) {
      console.error('Error creating extra order:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create extra order')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Loading reservation details...</div>
          <div className="text-sm text-muted-foreground">Please wait while we fetch the data</div>
        </div>
      </div>
    )
  }

  if (error || !reservation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-500">
          <div className="text-lg font-medium mb-2">Error loading reservation</div>
          <div className="text-sm">{error || 'Reservation not found'}</div>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/reservations')}>
            Back to Reservations
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Reservation #{reservation.id}</h1>
            <Badge className={`mt-2 flex items-center gap-1 ${getStatusColor(reservation.status)}`}>
              {getStatusIcon(reservation.status)}
              {reservation.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {isHost && (
              <>
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Edit Dates
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Reservation Dates</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="checkin">Check-in Date</Label>
                        <Input
                          id="checkin"
                          type="datetime-local"
                          value={editedDates.checkinAt}
                          onChange={(e) => setEditedDates((prev) => ({ ...prev, checkinAt: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="checkout">Check-out Date</Label>
                        <Input
                          id="checkout"
                          type="datetime-local"
                          value={editedDates.checkoutAt}
                          onChange={(e) => setEditedDates((prev) => ({ ...prev, checkoutAt: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleEditReservation}>Save Changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isBoxDialogOpen} onOpenChange={setIsBoxDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2" onClick={fetchAvailableBoxes}>
                      <MapPin className="h-4 w-4" />
                      Change Box
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Box</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="box">Select Box</Label>
                        <select
                          id="box"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedBoxId}
                          onChange={(e) => setSelectedBoxId(e.target.value)}
                        >
                          <option value="">Select a box</option>
                          {availableBoxes.map((box) => (
                            <option key={box.boxId} value={box.boxId}>
                              Box {box.boxId} - {box.location || 'No location'} (${formatPrice(box.pricePerNight)}/night)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBoxDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBoxChange} disabled={!selectedBoxId}>
                        Change Box
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Reservation</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">Are you sure you want to delete this reservation? This action cannot be undone.</div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteReservation}>
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {reservation.status === ReservationStatus.CHECKED_IN && (
                  <Button variant="default" onClick={() => handleStatusChange(ReservationStatus.CHECKED_OUT)}>
                    Check Out
                  </Button>
                )}
                {reservation.status === ReservationStatus.PENDING && (
                  <Button variant="destructive" onClick={() => handleStatusChange(ReservationStatus.CANCELLED)}>
                    Cancel
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={() => navigate('/reservations')}>
              Back to Reservations
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Box Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">Box ID</div>
                  <div className="text-sm text-muted-foreground">{reservation.box.boxId}</div>
                </div>
                <div>
                  <div className="font-medium text-sm">Location</div>
                  <div className="text-sm text-muted-foreground">{reservation.box.location || 'Not specified'}</div>
                </div>
                <div>
                  <div className="font-medium text-sm">Price per Night</div>
                  <div className="text-sm text-muted-foreground">${formatPrice(reservation.box.pricePerNight)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guest & Host Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                People
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">Guest</div>
                  <div className="text-sm text-muted-foreground">
                    {reservation.guest?.name} {reservation.guest?.surname} (ID: {reservation.guest?.id})
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm">Host</div>
                  <div className="text-sm text-muted-foreground">
                    {reservation.host?.name} {reservation.host?.surname} (ID: {reservation.host?.id})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Dates & Times
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">Planned Check-in</div>
                  <div className="text-sm text-muted-foreground">{new Date(reservation.checkinAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-medium text-sm">Planned Check-out</div>
                  <div className="text-sm text-muted-foreground">{new Date(reservation.checkoutAt).toLocaleString()}</div>
                </div>
                {reservation.actualCheckinAt && (
                  <div>
                    <div className="font-medium text-sm">Actual Check-in</div>
                    <div className="text-sm text-green-600">{new Date(reservation.actualCheckinAt).toLocaleString()}</div>
                  </div>
                )}
                {reservation.actualCheckoutAt && (
                  <div>
                    <div className="font-medium text-sm">Actual Check-out</div>
                    <div className="text-sm text-green-600">{new Date(reservation.actualCheckoutAt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">Total Price</div>
                  <div className="text-lg font-semibold text-green-600">
                    ${formatPrice(calculateNightsAndPrice(reservation.checkinAt, reservation.checkoutAt, reservation.box.pricePerNight).totalPrice)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm">Nights</div>
                  <div className="text-sm text-muted-foreground">
                    {calculateNightsAndPrice(reservation.checkinAt, reservation.checkoutAt, reservation.box.pricePerNight).nights}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">Extra Orders</h2>
            <Button onClick={() => setIsAddExtraOrderOpen(true)}>Add Extra Order</Button>
          </div>
          {loadingExtraOrders ? (
            <div>Loading extra orders...</div>
          ) : extraOrders.length === 0 ? (
            <div>No extra orders for this reservation.</div>
          ) : (
            <div className="space-y-2">
              {extraOrders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Order #{order.id}</div>
                      <div className="text-sm text-muted-foreground">Status: {order.status}</div>
                      <div className="text-sm text-muted-foreground">Created: {new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">Items:</div>
                      <ul className="text-sm">
                        {order.items.map((item, idx) => (
                          <li key={idx}>
                            {item.name || `Item #${item.inventoryItemId}`}: {item.quantity}
                          </li>
                        ))}
                      </ul>
                      {order.notes && <div className="text-xs mt-1">Notes: {order.notes}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAddExtraOrderOpen} onOpenChange={setIsAddExtraOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extra Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Items</label>
              {inventoryItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 mb-2">
                  <span className="w-32">{item.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={newOrder.items.find((i) => i.inventoryItemId === item.id)?.quantity || 0}
                    onChange={(e) => {
                      const qty = Number(e.target.value)
                      setNewOrder((prev) => {
                        const items = prev.items.filter((i) => i.inventoryItemId !== item.id)
                        return {
                          ...prev,
                          items: qty > 0 ? [...items, { inventoryItemId: item.id, quantity: qty }] : items,
                        }
                      })
                    }}
                    className="w-20 border rounded px-2 py-1"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block mb-1 font-medium">Notes</label>
              <textarea className="w-full border rounded px-2 py-1" value={newOrder.notes} onChange={(e) => setNewOrder((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddExtraOrderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExtraOrder} disabled={newOrder.items.length === 0}>
              Add Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
