"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

const data = [
  { name: "Jan", expected: 4000, actual: 2400 },
  { name: "Feb", expected: 3000, actual: 1398 },
  { name: "Mar", expected: 2000, actual: 9800 },
  { name: "Apr", expected: 2780, actual: 3908 },
  { name: "May", expected: 1890, actual: 4800 },
  { name: "Jun", expected: 2390, actual: 3800 },
  { name: "Jul", expected: 3490, actual: 4300 },
]

export function MonthlyComparisonChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))'
            }}
        />
        <Legend />
        <Bar dataKey="expected" fill="hsl(var(--secondary-foreground))" name="Expected" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
