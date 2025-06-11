import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchReservations } from '@/store/reservationsSlice'
import { fetchBoxes } from '@/store/boxesSlice'
import type { RootState, AppDispatch } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, User, MapPin, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { DateRange } from 'react-day-picker'
import { useNavigate } from 'react-router-dom'

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

// Filter types
type StatusFilter = 'ALL' | 'UPCOMMING' | 'CHECKIN' | 'CHECKOUT' | 'CANCELED'

interface FilterState {
  status: StatusFilter
  boxId: string
  dateRange: DateRange | undefined
}

interface User {
  id: number
  username: string
  userType: UserType
  createdAt: string
  updatedAt: string
}

interface BoxImage {
  id: number
  imageKey: string
  fileName: string
  mimeType: string
  fileSize: number
  imageUrl: string
  isPrimary: boolean
  createdAt: string
}

interface Box {
  id: number
  boxId: string
  location: string
  owner: User
  pricePerNight: number
  images?: BoxImage[]
}

interface BoxAvailability {
  boxId: string
  location: string
  unavailableDates: Array<{
    startDate: string
    endDate: string
    status: string
  }>
}

interface Reservation {
  id: number
  guest: User
  host: User
  box: Box
  checkinAt: string
  checkoutAt: string
  actualCheckinAt?: string
  actualCheckoutAt?: string
  status: ReservationStatus
  totalPrice?: number | string
}

// Simple box interface for the selector (from boxes slice)
interface SimpleBox {
  id: string
  boxId: string
  location: string
  status: string
  pricePerNight: number
}

export default function ReservationsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { items, loading, error } = useSelector((state: RootState) => state.reservations)
  const { items: boxes } = useSelector((state: RootState) => state.boxes)
  const user = useSelector((state: RootState) => state.auth.user)
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newReservationData, setNewReservationData] = useState({
    boxId: '',
    guestId: '',
    checkinAt: '',
    checkoutAt: '',
    hostId: user?.id || 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBoxAvailability, setSelectedBoxAvailability] = useState<BoxAvailability | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const navigate = useNavigate()

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    status: 'ALL',
    boxId: '',
    dateRange: undefined,
  })
  const [showFilters, setShowFilters] = useState(false)

  // Helper function to safely format price
  const calculateNightsAndPrice = (checkinAt: string, checkoutAt: string, pricePerNight: number | string) => {
    const nights = Math.ceil((new Date(checkoutAt).getTime() - new Date(checkinAt).getTime()) / (1000 * 60 * 60 * 24))
    const price = typeof pricePerNight === 'string' ? parseFloat(pricePerNight) : pricePerNight
    const totalPrice = nights * price
    return { nights, totalPrice }
  }

  const formatPrice = (price: number | string | undefined): string => {
    if (!price) return '0.00'
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)
  }

  // Helper function to map reservation status to filter status
  const getFilterStatus = (status: ReservationStatus): StatusFilter => {
    switch (status) {
      case ReservationStatus.PENDING:
        return 'UPCOMMING'
      case ReservationStatus.CHECKED_IN:
        return 'CHECKIN'
      case ReservationStatus.CHECKED_OUT:
        return 'CHECKOUT'
      case ReservationStatus.CANCELLED:
        return 'CANCELED'
      default:
        return 'ALL'
    }
  }

  // Helper function to get filter display name
  const getFilterDisplayName = (filter: StatusFilter): string => {
    switch (filter) {
      case 'UPCOMMING':
        return 'Upcoming'
      case 'CHECKIN':
        return 'Active'
      case 'CHECKOUT':
        return 'Past'
      case 'CANCELED':
        return 'Canceled'
      default:
        return 'All'
    }
  }

  // Filter reservations based on current filters
  const applyFilters = (reservations: Reservation[]): Reservation[] => {
    return reservations.filter((reservation) => {
      // Status filter
      if (filters.status !== 'ALL' && getFilterStatus(reservation.status) !== filters.status) {
        return false
      }

      // Box filter
      if (filters.boxId && reservation.box.boxId !== filters.boxId) {
        return false
      }

      // Date range filter
      if (filters.dateRange?.from || filters.dateRange?.to) {
        const checkinDate = new Date(reservation.checkinAt)
        const checkoutDate = new Date(reservation.checkoutAt)

        if (filters.dateRange.from && checkoutDate < filters.dateRange.from) {
          return false
        }

        if (filters.dateRange.to && checkinDate > filters.dateRange.to) {
          return false
        }
      }

      return true
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: 'ALL',
      boxId: '',
      dateRange: undefined,
    })
  }

  // Get count for each status
  const getStatusCounts = (reservations: Reservation[]) => {
    const counts = {
      ALL: reservations.length,
      UPCOMMING: 0,
      CHECKIN: 0,
      CHECKOUT: 0,
      CANCELED: 0,
    }

    reservations.forEach((reservation) => {
      const filterStatus = getFilterStatus(reservation.status)
      counts[filterStatus]++
    })

    return counts
  }

  useEffect(() => {
    dispatch(fetchReservations())
    dispatch(fetchBoxes())
  }, [dispatch])

  const validItems = (items as Reservation[])
    .filter((item) => {
      return item && item.id
    })
    .sort((a, b) => {
      const now = new Date()
      const dateA = new Date(a.checkinAt)
      const dateB = new Date(b.checkinAt)
      // Calculate absolute difference from current date
      const diffA = Math.abs(dateA.getTime() - now.getTime())
      const diffB = Math.abs(dateB.getTime() - now.getTime())
      return diffA - diffB
    })

  // Apply filters to get filtered reservations
  const filteredReservations = applyFilters(validItems)
  const statusCounts = getStatusCounts(validItems)
  const totalReservations = filteredReservations.length

  const validBoxes = (boxes as SimpleBox[]).filter((item) => {
    const hasId = item && typeof item.boxId === 'string' && item.boxId.length > 0
    return hasId
  })

  const fetchBoxAvailability = async (boxId: string) => {
    if (!token) return

    setIsLoadingAvailability(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/boxes/${boxId}/availability`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch box availability')
      }

      const data = await response.json()
      setSelectedBoxAvailability(data)
    } catch (error) {
      console.error('Error fetching box availability:', error)
      setSelectedBoxAvailability(null)
    } finally {
      setIsLoadingAvailability(false)
    }
  }

  const handleBoxChange = (boxId: string) => {
    setNewReservationData((prev) => ({ ...prev, boxId }))
    fetchBoxAvailability(boxId)
  }

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

  const handleAddReservation = async () => {
    if (!user?.id || !token) {
      console.error('No user ID or token available')
      return
    }

    console.log('Starting reservation creation with data:', {
      newReservationData,
      user: user.id,
      token: token ? 'Token exists' : 'No token',
    })

    setIsSubmitting(true)
    try {
      const requestBody = {
        guestId: parseInt(newReservationData.guestId),
        hostId: user.id,
        boxId: newReservationData.boxId,
        checkinAt: newReservationData.checkinAt,
        checkoutAt: newReservationData.checkoutAt,
      }

      console.log('Sending reservation request with body:', requestBody)

      const response = await fetch(`${import.meta.env.VITE_API_URL}/reservations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response from server:', errorText)
        throw new Error(`Failed to add reservation: ${errorText}`)
      }

      const responseData = await response.json()
      console.log('Successfully created reservation:', responseData)

      // Refresh the reservations list
      dispatch(fetchReservations())
      setIsAddDialogOpen(false)
      setNewReservationData({
        boxId: '',
        guestId: '',
        checkinAt: '',
        checkoutAt: '',
        hostId: user?.id || 0,
      })
      setSelectedBoxAvailability(null)
    } catch (error) {
      console.error('Error in handleAddReservation:', error)
      // TODO: Show error message to user
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDateUnavailable = (date: Date) => {
    if (!selectedBoxAvailability) return false

    return selectedBoxAvailability.unavailableDates.some(({ startDate, endDate }) => {
      const start = new Date(startDate)
      const end = new Date(endDate)
      return date >= start && date <= end
    })
  }

  const findOverlappingDates = (from: Date, to: Date): { startDate: string; endDate: string } | null => {
    if (!selectedBoxAvailability) return null

    const overlapping = selectedBoxAvailability.unavailableDates.find(({ startDate, endDate }) => {
      const unavailableStart = new Date(startDate)
      const unavailableEnd = new Date(endDate)
      return from <= unavailableEnd && unavailableStart <= to
    })

    return overlapping || null
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
    if (range?.from && range.from instanceof Date) {
      // If we have both from and to dates, check if the range is valid
      if (range.to && range.to instanceof Date) {
        // Check for overlapping dates
        const overlapping = findOverlappingDates(range.from, range.to)
        if (overlapping) {
          const formatDate = (dateStr: string) => format(new Date(dateStr), 'MMM d, yyyy')
          // For now, we'll use a simple alert until we add the toast component
          alert(
            `Your selected dates overlap with an existing reservation from ${formatDate(overlapping.startDate)} to ${formatDate(overlapping.endDate)}. Please try different dates.`,
          )
          return
        }
      }

      setNewReservationData((prev) => ({
        ...prev,
        checkinAt: range.from!.toISOString(),
        checkoutAt: range.to ? range.to.toISOString() : '',
      }))
    } else {
      setNewReservationData((prev) => ({
        ...prev,
        checkinAt: '',
        checkoutAt: '',
      }))
    }
  }

  return (
    <div key="page-container" className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div key="content-container" className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reservations</h1>
            <p className="text-sm text-muted-foreground">
              Showing {totalReservations} of {validItems.length} reservations
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {(filters.status !== 'ALL' || filters.boxId || filters.dateRange) && (
                <Badge variant="secondary" className="ml-1">
                  Active
                </Badge>
              )}
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Reservation
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filter Reservations</h3>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear All
                </Button>
              </div>

              {/* Status Filter */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {(['ALL', 'UPCOMMING', 'CHECKIN', 'CHECKOUT', 'CANCELED'] as StatusFilter[]).map((status) => (
                    <Button
                      key={status}
                      variant={filters.status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters((prev) => ({ ...prev, status }))}
                      className="flex items-center gap-2"
                    >
                      {status !== 'ALL' &&
                        getStatusIcon(
                          status === 'UPCOMMING'
                            ? ReservationStatus.PENDING
                            : status === 'CHECKIN'
                            ? ReservationStatus.CHECKED_IN
                            : status === 'CHECKOUT'
                            ? ReservationStatus.CHECKED_OUT
                            : ReservationStatus.CANCELLED,
                        )}
                      {getFilterDisplayName(status)}
                      <Badge variant="secondary" className="ml-1">
                        {statusCounts[status]}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Box Filter */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Box</Label>
                <Select value={filters.boxId || 'all'} onValueChange={(value) => setFilters((prev) => ({ ...prev, boxId: value === 'all' ? '' : value }))}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="All boxes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boxes</SelectItem>
                    {validBoxes.map((box) => (
                      <SelectItem key={box.boxId} value={box.boxId}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">Box {box.boxId}</span>
                          <span className="text-muted-foreground ml-2">{box.location}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full max-w-md justify-start text-left font-normal', !filters.dateRange && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, 'LLL dd, y')} - {format(filters.dateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(filters.dateRange.from, 'LLL dd, y')
                        )
                      ) : (
                        <span>Filter by date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      initialFocus
                      mode="range"
                      defaultMonth={filters.dateRange?.from}
                      selected={filters.dateRange}
                      onSelect={(range) => setFilters((prev) => ({ ...prev, dateRange: range }))}
                      numberOfMonths={2}
                      className="rounded-md"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">Loading reservations...</div>
              <div className="text-sm text-muted-foreground">Please wait while we fetch your reservations</div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-red-500">
              <div className="text-lg font-medium mb-2">Error loading reservations</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && filteredReservations.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredReservations.map((reservation) => (
              <Card key={`reservation-${reservation.id}`} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Reservation #{reservation.id}</CardTitle>
                    <Badge className={`flex items-center gap-1 ${getStatusColor(reservation.status)}`}>
                      {getStatusIcon(reservation.status)}
                      {getFilterDisplayName(getFilterStatus(reservation.status))}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  {/* Box Information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Box Details
                    </div>
                    <div className="ml-6 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Box ID:</span>
                        <span className="text-sm font-medium">{reservation.box.boxId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Location:</span>
                        <span className="text-sm font-medium">{reservation.box.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Price/Night:</span>
                        <span className="text-sm font-medium">${reservation.box.pricePerNight}</span>
                      </div>
                    </div>
                  </div>

                  {/* Guest Information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Guest Details
                    </div>
                    <div className="ml-6 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Guest:</span>
                        <span className="text-sm font-medium">{reservation.guest?.username || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Guest ID:</span>
                        <span className="text-sm font-medium">{reservation.guest?.id || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reservation Dates */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Stay Period
                    </div>
                    <div className="ml-6 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Check-in:</span>
                        <span className="text-sm font-medium">{new Date(reservation.checkinAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Check-out:</span>
                        <span className="text-sm font-medium">{new Date(reservation.checkoutAt).toLocaleDateString()}</span>
                      </div>
                      {reservation.actualCheckinAt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Actual Check-in:</span>
                          <span className="text-sm font-medium text-green-600">{new Date(reservation.actualCheckinAt).toLocaleString()}</span>
                        </div>
                      )}
                      {reservation.actualCheckoutAt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Actual Check-out:</span>
                          <span className="text-sm font-medium text-green-600">{new Date(reservation.actualCheckoutAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Information */}
                  {reservation.totalPrice && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        Payment
                      </div>
                      <div className="ml-6">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Price:</span>
                          <span className="text-sm font-medium text-green-600">
                            ${formatPrice(calculateNightsAndPrice(reservation.checkinAt, reservation.checkoutAt, reservation.box.pricePerNight).totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button size="sm" className="w-full" onClick={() => navigate(`/reservations/${reservation.id}`)}>
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && filteredReservations.length === 0 && validItems.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No reservations match your filters</div>
              <div className="text-sm text-muted-foreground mb-4">Try adjusting your filter criteria</div>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && validItems.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No reservations found</div>
              <div className="text-sm text-muted-foreground">You don't have any reservations yet</div>
            </div>
          </div>
        )}
      </div>

      {/* Add Reservation Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create New Reservation</DialogTitle>
            <DialogDescription>Select a box and pick your reservation dates</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step 1: Box Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
                <Label className="text-base font-medium">Select Box</Label>
              </div>
              <Select
                value={newReservationData.boxId}
                onValueChange={(value) => {
                  handleBoxChange(value)
                  setShowDatePicker(true)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a box to create reservation for..." />
                </SelectTrigger>
                <SelectContent>
                  {validBoxes.map((box) => (
                    <SelectItem key={box.boxId} value={box.boxId}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Box {box.boxId}</span>
                        <span className="text-muted-foreground ml-2">{box.location}</span>
                        <span className="text-green-600 font-medium ml-2">${box.pricePerNight}/night</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Date Selection */}
            {newReservationData.boxId && showDatePicker && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">2</div>
                  <Label className="text-base font-medium">Pick Dates</Label>
                </div>

                {isLoadingAvailability && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Loading availability...</div>
                    </div>
                  </div>
                )}

                {!isLoadingAvailability && (
                  <div className="space-y-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                              </>
                            ) : (
                              format(dateRange.from, 'LLL dd, y')
                            )
                          ) : (
                            <span>Select your stay dates</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 border-b bg-muted/50">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-sm bg-red-500/90 border border-red-600" />
                            <span className="text-muted-foreground">Unavailable dates</span>
                          </div>
                        </div>
                        <CalendarPicker
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={(range: DateRange | undefined) => handleDateRangeChange(range)}
                          numberOfMonths={2}
                          disabled={(date: Date) => {
                            // Disable past dates
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            if (date < today) return true

                            // Disable unavailable dates
                            return isDateUnavailable(date)
                          }}
                          className="rounded-md"
                          classNames={{
                            months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                            month: 'space-y-4',
                            caption: 'flex justify-center pt-1 relative items-center',
                            caption_label: 'text-sm font-medium',
                            nav: 'space-x-1 flex items-center',
                            nav_button: cn(
                              'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0',
                            ),
                            nav_button_previous: 'absolute left-1',
                            nav_button_next: 'absolute right-1',
                            table: 'w-full border-collapse space-y-1',
                            head_row: 'flex',
                            head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
                            row: 'flex w-full mt-2',
                            cell: 'text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                            day: cn(
                              'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-selected:opacity-100 h-9 w-9 p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground hover:bg-accent hover:text-accent-foreground',
                            ),
                            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                            day_today: 'bg-accent text-accent-foreground',
                            day_outside: 'text-muted-foreground opacity-50',
                            day_disabled: 'text-muted-foreground opacity-50 cursor-not-allowed bg-red-100 hover:bg-red-100 text-red-900 font-medium',
                            day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
                            day_hidden: 'invisible',
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    {dateRange?.from && dateRange?.to && (
                      <div className="text-sm text-muted-foreground">{Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} night stay</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Guest Information */}
            {newReservationData.checkinAt && newReservationData.checkoutAt && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">3</div>
                  <Label className="text-base font-medium">Guest Information</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guestId" className="text-sm">
                    Guest ID
                  </Label>
                  <Input
                    id="guestId"
                    value={newReservationData.guestId}
                    onChange={(e) => setNewReservationData((prev) => ({ ...prev, guestId: e.target.value }))}
                    placeholder="Enter the guest's user ID"
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground">The numeric ID of the guest user who will use this reservation</p>
                </div>
              </div>
            )}

            {/* Booking Summary */}
            {newReservationData.boxId && newReservationData.checkinAt && newReservationData.checkoutAt && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-3">Reservation Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Box:</span>
                    <div className="font-medium">{newReservationData.boxId}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dates:</span>
                    <div className="font-medium">
                      {format(new Date(newReservationData.checkinAt), 'MMM d')} - {format(new Date(newReservationData.checkoutAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nights:</span>
                    <div className="font-medium">
                      {Math.ceil((new Date(newReservationData.checkoutAt).getTime() - new Date(newReservationData.checkinAt).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Price:</span>
                    <div className="font-medium text-green-600">
                      $
                      {(validBoxes.find((b) => b.boxId === newReservationData.boxId)?.pricePerNight || 0) *
                        Math.ceil((new Date(newReservationData.checkoutAt).getTime() - new Date(newReservationData.checkinAt).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setSelectedBoxAvailability(null)
                setShowDatePicker(false)
                setNewReservationData({
                  boxId: '',
                  guestId: '',
                  checkinAt: '',
                  checkoutAt: '',
                  hostId: user?.id || 0,
                })
              }}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddReservation}
              disabled={isSubmitting || !newReservationData.boxId || !newReservationData.guestId || !newReservationData.checkinAt || !newReservationData.checkoutAt}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Creating Reservation...' : 'Create Reservation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
            <DialogDescription>Complete information about reservation #{selectedReservation?.id}</DialogDescription>
          </DialogHeader>
          {selectedReservation && (
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-sm">Reservation ID</div>
                    <div className="text-sm text-muted-foreground">{selectedReservation.id}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Status</div>
                    <Badge className={`${getStatusColor(selectedReservation.status)} flex items-center gap-1 w-fit`}>
                      {getStatusIcon(selectedReservation.status)}
                      {selectedReservation.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Box Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Box Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-sm">Box ID</div>
                    <div className="text-sm text-muted-foreground">{selectedReservation.box.boxId}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Location</div>
                    <div className="text-sm text-muted-foreground">{selectedReservation.box.location}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Price per Night</div>
                    <div className="text-sm text-muted-foreground">${selectedReservation.box.pricePerNight}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Box Owner</div>
                    <div className="text-sm text-muted-foreground">{selectedReservation.box.owner?.username || 'Unknown'}</div>
                  </div>
                </div>
              </div>

              {/* Guest & Host Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">People</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-sm">Guest</div>
                    <div className="text-sm text-muted-foreground">{selectedReservation.guest?.username || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Host</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedReservation.host.username} (ID: {selectedReservation.host.id})
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dates & Times</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-sm">Planned Check-in</div>
                    <div className="text-sm text-muted-foreground">{new Date(selectedReservation.checkinAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Planned Check-out</div>
                    <div className="text-sm text-muted-foreground">{new Date(selectedReservation.checkoutAt).toLocaleString()}</div>
                  </div>
                  {selectedReservation.actualCheckinAt && (
                    <div>
                      <div className="font-medium text-sm">Actual Check-in</div>
                      <div className="text-sm text-green-600">{new Date(selectedReservation.actualCheckinAt).toLocaleString()}</div>
                    </div>
                  )}
                  {selectedReservation.actualCheckoutAt && (
                    <div>
                      <div className="font-medium text-sm">Actual Check-out</div>
                      <div className="text-sm text-green-600">{new Date(selectedReservation.actualCheckoutAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial */}
              {selectedReservation.totalPrice && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Financial</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium text-sm">Total Price</div>
                      <div className="text-lg font-semibold text-green-600">${formatPrice(selectedReservation.totalPrice)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">Nights</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.ceil((new Date(selectedReservation.checkoutAt).getTime() - new Date(selectedReservation.checkinAt).getTime()) / (1000 * 60 * 60 * 24))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
