// src/pages/HomePage.tsx

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBoxes } from '@/store/boxesSlice'
import { fetchReservations } from '@/store/reservationsSlice'
import { fetchRevenue } from '@/store/revenueSlice'
import type { RootState, AppDispatch } from '@/store'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import type { ChartConfig } from '@/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import React from 'react'

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
  const revenueStats = revenue as unknown as RevenueData
  const [reservationsTimeRange, setReservationsTimeRange] = React.useState('90d')
  const [revenueTimeRange, setRevenueTimeRange] = React.useState('90d')

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

  // Prepare data for charts
  const prepareChartData = (timeRange: string) => {
    const now = new Date()
    const daysToSubtract = timeRange === '30d' ? 30 : timeRange === '7d' ? 7 : 90
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysToSubtract)

    // Create a map of dates to store aggregated data
    const dateMap = new Map()
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dateMap.set(dateStr, {
        date: dateStr,
        activeReservations: 0,
        totalReservations: 0,
        revenue: 0,
      })
    }

    // Aggregate reservations data
    validReservations.forEach((reservation) => {
      const checkin = new Date(reservation.checkinAt)
      const checkout = new Date(reservation.checkoutAt)
      const totalPrice = Number(reservation.totalPrice) || 0
      const days = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24))
      const dailyPrice = days > 0 ? totalPrice / days : 0

      for (let d = new Date(checkin); d <= checkout; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        if (dateMap.has(dateStr)) {
          const data = dateMap.get(dateStr)
          data.totalReservations++
          if (d >= startDate && d <= now) {
            data.activeReservations++
            data.revenue += dailyPrice
          }
        }
      }
    })

    return Array.from(dateMap.values())
  }

  const reservationsChartData = prepareChartData(reservationsTimeRange)
  const revenueChartData = prepareChartData(revenueTimeRange)

  const reservationsChartConfig = {
    activeReservations: {
      label: 'Active Reservations',
      color: 'var(--primary)',
    },
    totalReservations: {
      label: 'Total Reservations',
      color: 'var(--secondary)',
    },
  } satisfies ChartConfig

  const revenueChartConfig = {
    revenue: {
      label: 'Revenue',
      color: 'var(--primary)',
    },
  } satisfies ChartConfig

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
              <div className="text-3xl font-bold">${revenueStats?.totalRevenue?.toFixed(2) || '0.00'}</div>
              <div className="space-y-1 mt-2">
                <p className="text-sm text-muted-foreground">{revenueStats?.totalBookings || 0} total bookings</p>
                <p className="text-sm text-muted-foreground">${revenueStats?.averageRevenuePerBooking?.toFixed(2) || '0.00'} avg. per booking</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Reservations Chart */}
          <Card>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
              <div className="grid flex-1 gap-1">
                <CardTitle>Reservations Overview</CardTitle>
                <CardDescription>Showing reservations data for the selected period</CardDescription>
              </div>
              <Select value={reservationsTimeRange} onValueChange={setReservationsTimeRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90d">Last 3 months</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              <ChartContainer config={reservationsChartConfig} className="aspect-auto h-[250px] w-full">
                <AreaChart data={reservationsChartData}>
                  <defs>
                    <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-activeReservations)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-activeReservations)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-totalReservations)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-totalReservations)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => {
                          return new Date(value).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }}
                        formatter={(value, name) => {
                          if (name === 'activeReservations') {
                            return `${value} active`
                          }
                          return `${value} total`
                        }}
                        indicator="dot"
                      />
                    }
                  />
                  <Area dataKey="activeReservations" type="monotone" fill="url(#fillActive)" stroke="var(--color-activeReservations)" strokeWidth={2} stackId="a" />
                  <Area dataKey="totalReservations" type="monotone" fill="url(#fillTotal)" stroke="var(--color-totalReservations)" strokeWidth={2} stackId="a" />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
              <div className="grid flex-1 gap-1">
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Showing revenue data for the selected period</CardDescription>
              </div>
              <Select value={revenueTimeRange} onValueChange={setRevenueTimeRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90d">Last 3 months</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              <ChartContainer config={revenueChartConfig} className="aspect-auto h-[250px] w-full">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => {
                          return new Date(value).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }}
                        formatter={(value) => {
                          const numValue = Number(value)
                          return isNaN(numValue) ? '$0.00' : `$${numValue.toFixed(2)}`
                        }}
                        indicator="dot"
                      />
                    }
                  />
                  <Area dataKey="revenue" type="monotone" fill="url(#fillRevenue)" stroke="var(--color-revenue)" strokeWidth={2} />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
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
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className="text-sm font-medium">
                          {reservation.status === 'CHECKED_OUT'
                            ? 'Completed'
                            : reservation.status === 'CHECKED_IN'
                            ? 'Active'
                            : reservation.status === 'PENDING'
                            ? 'Upcoming'
                            : reservation.status === 'CANCELLED'
                            ? 'Cancelled'
                            : reservation.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${reservation.totalPrice ? Number(reservation.totalPrice).toFixed(2) : '0.00'}</div>
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
