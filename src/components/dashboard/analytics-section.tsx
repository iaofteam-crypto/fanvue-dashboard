"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EARNINGS_DATA = [
  { month: "Jan", earnings: 2400, tips: 800, subs: 1600 },
  { month: "Feb", earnings: 1398, tips: 500, subs: 898 },
  { month: "Mar", earnings: 3200, tips: 1200, subs: 2000 },
  { month: "Apr", earnings: 2780, tips: 900, subs: 1880 },
  { month: "May", earnings: 3890, tips: 1400, subs: 2490 },
  { month: "Jun", earnings: 3490, tips: 1100, subs: 2390 },
  { month: "Jul", earnings: 4200, tips: 1500, subs: 2700 },
  { month: "Aug", earnings: 3800, tips: 1300, subs: 2500 },
  { month: "Sep", earnings: 4350, tips: 1600, subs: 2750 },
  { month: "Oct", earnings: 4100, tips: 1400, subs: 2700 },
  { month: "Nov", earnings: 4600, tips: 1700, subs: 2900 },
  { month: "Dec", earnings: 5200, tips: 1900, subs: 3300 },
];

const SUBSCRIBER_DATA = [
  { month: "Jan", subscribers: 450 },
  { month: "Feb", subscribers: 520 },
  { month: "Mar", subscribers: 680 },
  { month: "Apr", subscribers: 750 },
  { month: "May", subscribers: 890 },
  { month: "Jun", subscribers: 950 },
  { month: "Jul", subscribers: 1020 },
  { month: "Aug", subscribers: 1080 },
  { month: "Sep", subscribers: 1100 },
  { month: "Oct", subscribers: 1150 },
  { month: "Nov", subscribers: 1200 },
  { month: "Dec", subscribers: 1247 },
];

const ENGAGEMENT_DATA = [
  { name: "Messages", value: 89, color: "#38bdf8" },
  { name: "Tips", value: 45, color: "#a78bfa" },
  { name: "Post Likes", value: 234, color: "#f97316" },
  { name: "Comments", value: 67, color: "#34d399" },
  { name: "Shares", value: 23, color: "#fb7185" },
];

const REVENUE_SOURCES = [
  { name: "Subscriptions", value: 65, color: "#34d399" },
  { name: "Tips", value: 20, color: "#38bdf8" },
  { name: "PPV Content", value: 10, color: "#a78bfa" },
  { name: "Other", value: 5, color: "#f97316" },
];

export function AnalyticsSection({ connected }: { connected: boolean }) {
  const [period, setPeriod] = useState("12m");

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Connect your Fanvue account to view analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Track your earnings, subscribers, and engagement metrics
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Earnings", value: "$45,308", change: "+12.5%" },
          { label: "Avg Monthly", value: "$3,775", change: "+8.3%" },
          { label: "Top Earner", value: "December", change: "$5,200" },
          { label: "Growth Rate", value: "177%", change: "12 months" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-emerald-400 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Earnings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={EARNINGS_DATA}>
                  <defs>
                    <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tipsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="subs"
                    stackId="1"
                    stroke="#34d399"
                    fill="url(#earningsGrad)"
                    name="Subscriptions"
                  />
                  <Area
                    type="monotone"
                    dataKey="tips"
                    stackId="1"
                    stroke="#38bdf8"
                    fill="url(#tipsGrad)"
                    name="Tips"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Subscriber Growth */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Subscriber Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SUBSCRIBER_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="subscribers" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Engagement Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ENGAGEMENT_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ENGAGEMENT_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 ml-4">
                {ENGAGEMENT_DATA.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Sources */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Revenue Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
              {REVENUE_SOURCES.map((source) => (
                <div key={source.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span>{source.name}</span>
                    </div>
                    <span className="text-muted-foreground">{source.value}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${source.value}%`,
                        backgroundColor: source.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
