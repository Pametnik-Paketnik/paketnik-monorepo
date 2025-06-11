import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, User, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

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
  username: string
  userType: UserType
  createdAt: string
  updatedAt: string
}

interface Box {
  id: string
  boxId: string
  location: string | null
  pricePerNight: string | number
  owner: User
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

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          <Button variant="outline" onClick={() => navigate('/reservations')}>
            Back to Reservations
          </Button>
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
                <div>
                  <div className="font-medium text-sm">Box Owner</div>
                  <div className="text-sm text-muted-foreground">{reservation.box.owner?.username || 'Unknown'}</div>
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
                    {reservation.guest?.username || 'Unknown'} (ID: {reservation.guest?.id || 'Unknown'})
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm">Host</div>
                  <div className="text-sm text-muted-foreground">
                    {reservation.host?.username || 'Unknown'} (ID: {reservation.host?.id || 'Unknown'})
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
          {reservation.totalPrice && (
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
                    <div className="text-lg font-semibold text-green-600">${formatPrice(reservation.totalPrice)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Nights</div>
                    <div className="text-sm text-muted-foreground">
                      {Math.ceil((new Date(reservation.checkoutAt).getTime() - new Date(reservation.checkinAt).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
