// src/pages/HomePage.tsx

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBoxes } from '@/store/boxesSlice'
import { fetchReservations } from '@/store/reservationsSlice'
import { fetchRevenue } from '@/store/revenueSlice'
import type { RootState, AppDispatch } from '@/store'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface Box {
  id: string
  name: string | null
  hostId: number | null
  pricePerNight: string | number
  boxId: string
  location?: string
  status?: string
}

interface Reservation {
  id: string
  boxId: string
  guestId: string
  checkinAt: string
  checkoutAt: string
  status: string
  totalPrice: number
}

interface RevenueData {
  totalRevenue: number
  totalBookings: number
  averageRevenuePerBooking: number
  boxesRevenue: Array<{
    boxId: string
    totalRevenue: number
    totalBookings: number
  }>
}

export default function HomePage() {
  const dispatch = useDispatch<AppDispatch>()
  const { items: boxes, loading: boxesLoading } = useSelector((state: RootState) => state.boxes)
  const { items: reservations, loading: reservationsLoading } = useSelector((state: RootState) => state.reservations)
  const { items: revenue, loading: revenueLoading } = useSelector((state: RootState) => state.revenue)
  const revenueData = revenue as unknown as RevenueData

  useEffect(() => {
    console.log('Fetching data...')
    dispatch(fetchBoxes())
    dispatch(fetchReservations())
    dispatch(fetchRevenue())
  }, [dispatch])

  const validBoxes = (boxes as Box[]).filter((item) => {
    const hasId = item && typeof item.boxId === 'string' && item.boxId.length > 0
    return hasId
  })

  console.log('Raw reservations:', reservations)

  const validReservations = (reservations as Reservation[])
    .filter((item) => {
      console.log('Checking reservation:', item)
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

  console.log('Valid reservations:', validReservations)
  console.log('Total reservations:', validReservations.length)
  console.log('Active reservations:', validReservations.filter((r) => r.status === 'CHECKED_IN').length)

  const totalReservations = validReservations.length
  const activeReservations = validReservations.filter((r) => {
    const now = new Date()
    const checkin = new Date(r.checkinAt)
    const checkout = new Date(r.checkoutAt)
    return now >= checkin && now <= checkout
  }).length

  const isLoading = boxesLoading || reservationsLoading || revenueLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Loading dashboard...</div>
          <div className="text-sm text-muted-foreground">Please wait while we fetch your data</div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Boxes Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Boxes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{validBoxes.length}</div>
              <p className="text-sm text-muted-foreground">Active boxes in your system</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to="/boxes">View All Boxes</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Active Reservations Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalReservations}</div>
              <p className="text-sm text-muted-foreground">{activeReservations} active reservations</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to="/reservations">View All Reservations</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Revenue Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${revenueData?.totalRevenue?.toFixed(2) || '0.00'}</div>
              <div className="space-y-1 mt-2">
                <p className="text-sm text-muted-foreground">{revenueData?.totalBookings || 0} total bookings</p>
                <p className="text-sm text-muted-foreground">${revenueData?.averageRevenuePerBooking?.toFixed(2) || '0.00'} avg. per booking</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Recent Boxes */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Boxes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validBoxes.slice(0, 5).map((box) => (
                  <div key={box.boxId} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Box {box.boxId}</div>
                      <div className="text-sm text-muted-foreground">{box.location || 'No location'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${Number(box.pricePerNight || 0).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{box.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Reservations */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validReservations.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Reservation #{reservation.id}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(reservation.checkinAt).toLocaleDateString()} - {new Date(reservation.checkoutAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${reservation.totalPrice ? Number(reservation.totalPrice).toFixed(2) : '0.00'}</div>
                      <div className="text-sm text-muted-foreground">{reservation.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
