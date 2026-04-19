"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "pending" | "blocked";
  progress: number;
  subtasks: { title: string; done: boolean }[];
}

const TASKS: Task[] = [
  {
    id: "M1",
    title: "Infrastructure Setup",
    description: "Set up the core infrastructure for the Fanvue Ops dashboard",
    status: "completed",
    progress: 100,
    subtasks: [
      { title: "Next.js project initialization", done: true },
      { title: "Prisma schema & database", done: true },
      { title: "OAuth2 PKCE implementation", done: true },
      { title: "API proxy routes", done: true },
      { title: "Environment configuration", done: true },
    ],
  },
  {
    id: "M2",
    title: "Dashboard & Analytics",
    description: "Build the main dashboard with real-time analytics",
    status: "in-progress",
    progress: 85,
    subtasks: [
      { title: "Dashboard overview cards", done: true },
      { title: "Earnings chart", done: true },
      { title: "Subscriber growth chart", done: true },
      { title: "Engagement breakdown", done: true },
      { title: "Revenue source analysis", done: true },
      { title: "Date range filtering", done: false },
    ],
  },
  {
    id: "M3",
    title: "Messaging System",
    description: "Implement the fan messaging interface",
    status: "in-progress",
    progress: 75,
    subtasks: [
      { title: "Chat list view", done: true },
      { title: "Message thread view", done: true },
      { title: "Send message functionality", done: true },
      { title: "Real-time updates", done: false },
      { title: "Message search", done: false },
    ],
  },
  {
    id: "M4",
    title: "Content Management",
    description: "Build content creation and management tools",
    status: "in-progress",
    progress: 60,
    subtasks: [
      { title: "Posts list view", done: true },
      { title: "Create post form", done: true },
      { title: "Media upload integration", done: false },
      { title: "Post scheduling", done: false },
      { title: "Content calendar", done: false },
    ],
  },
  {
    id: "M5",
    title: "AI Integration & Automation",
    description: "AELIANA AI assistant and automated workflows",
    status: "in-progress",
    progress: 50,
    subtasks: [
      { title: "AELIANA chat interface", done: true },
      { title: "CEO mode personality", done: true },
      { title: "Data-aware responses", done: false },
      { title: "Automated insights", done: false },
      { title: "Proactive notifications", done: false },
    ],
  },
];

export function TasksSection() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const statusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "in-progress": return <Clock className="w-5 h-5 text-amber-400" />;
      case "blocked": return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: Task["status"]) => {
    switch (status) {
      case "completed": return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">Completed</Badge>;
      case "in-progress": return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">In Progress</Badge>;
      case "blocked": return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20">Blocked</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const overallProgress = Math.round(
    TASKS.reduce((sum, t) => sum + t.progress, 0) / TASKS.length
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Track milestone progress and task completion
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {overallProgress}% Overall
        </Badge>
      </div>

      {/* Overall Progress */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {TASKS.filter((t) => t.status === "completed").length}/{TASKS.length} milestones completed
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: "Completed", count: TASKS.filter((t) => t.status === "completed").length, color: "text-emerald-400" },
              { label: "In Progress", count: TASKS.filter((t) => t.status === "in-progress").length, color: "text-amber-400" },
              { label: "Pending", count: TASKS.filter((t) => t.status === "pending").length, color: "text-muted-foreground" },
              { label: "Blocked", count: TASKS.filter((t) => t.status === "blocked").length, color: "text-red-400" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task Cards */}
      <div className="space-y-3">
        {TASKS.map((task) => (
          <Card
            key={task.id}
            className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {statusIcon(task.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary">{task.id}</span>
                    <CardTitle className="text-sm font-semibold">
                      {task.title}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(task.status)}
                  {expandedTask === task.id ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {expandedTask === task.id && (
              <CardContent className="pt-0">
                <div className="ml-8 space-y-3">
                  <div className="flex items-center gap-3">
                    <Progress value={task.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {task.subtasks.map((subtask, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {subtask.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            subtask.done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
