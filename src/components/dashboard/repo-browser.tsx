"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface RepoFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  content?: string;
}

const DEMO_FILES: RepoFile[] = [
  { name: "handoff.md", path: "handoff.md", type: "file", size: 15240 },
  { name: "TASKS.md", path: "TASKS.md", type: "file", size: 8930 },
  { name: "DASHBOARD.md", path: "DASHBOARD.md", type: "file", size: 5210 },
  { name: "output", path: "output", type: "dir" },
  { name: ".env.example", path: ".env.example", type: "file", size: 340 },
  { name: "README.md", path: "README.md", type: "file", size: 1200 },
];

const DEMO_OUTPUT_FILES: RepoFile[] = [
  { name: "discovery_D001.md", path: "output/discovery_D001.md", type: "file", size: 2100 },
  { name: "discovery_D002.md", path: "output/discovery_D002.md", type: "file", size: 1850 },
  { name: "discovery_D003.md", path: "output/discovery_D003.md", type: "file", size: 2400 },
  { name: "task_M1_summary.md", path: "output/task_M1_summary.md", type: "file", size: 1500 },
  { name: "task_M2_progress.md", path: "output/task_M2_progress.md", type: "file", size: 900 },
  { name: "analytics_report.md", path: "output/analytics_report.md", type: "file", size: 3200 },
];

const DEMO_CONTENT: Record<string, string> = {
  "handoff.md": `# Fanvue Ops — Project Handoff

## Overview
This document outlines the complete strategy for building and deploying the Fanvue Ops Dashboard, an AI-powered operations platform for Fanvue creators.

## Key Discoveries (D1-D12)

### D1 — AI Content Generation Opportunity
**Category**: Technology  
**Impact**: High  
**Priority**: Implement within Q1

The integration of AI content generation tools can significantly reduce content creation time while maintaining quality. Key findings suggest creators using AI-assisted workflows see 40% higher output rates.

### D2 — Cross-Platform Engagement Strategy  
**Category**: Marketing  
**Impact**: Medium  
**Priority**: Q2 implementation

Analysis shows that cross-platform content distribution increases fan engagement by 35%. Recommendation: Implement automated cross-posting to Twitter, Instagram, and Reddit.

### D3 — Premium Tier Pricing Analysis
**Category**: Revenue  
**Impact**: High  
**Priority**: Immediate

Data suggests current pricing is 15-20% below market optimum. Recommended adjustments:
- Basic tier: $9.99 → $12.99/month
- Premium tier: $24.99 → $29.99/month  
- VIP tier: $49.99 → $59.99/month

## Milestones (M1-M5)

### M1: Infrastructure Setup ✅
- [x] Next.js project initialization
- [x] Prisma schema & database
- [x] OAuth2 PKCE implementation
- [x] API proxy routes
- [x] Environment configuration

### M2: Dashboard & Analytics (In Progress)
- [x] Dashboard overview cards
- [x] Earnings chart
- [x] Subscriber growth chart
- [ ] Date range filtering
- [ ] Export reports`,

  "TASKS.md": `# Fanvue Ops — Task Tracker

## Current Sprint: Dashboard v1.0

### Priority: Critical 🔴
- [ ] Fix OAuth token refresh edge case
- [ ] Add error boundaries to all API routes
- [ ] Implement rate limiting for Fanvue API calls

### Priority: High 🟡
- [x] Dashboard overview with real-time stats
- [x] Earnings analytics with charts
- [x] Message inbox with chat interface
- [ ] Content management with post creation
- [ ] AELIANA AI chat integration

### Priority: Medium 🟢
- [ ] Dark/light theme toggle
- [ ] Mobile responsive design polish
- [ ] Keyboard shortcuts
- [ ] Search functionality

### Priority: Low ⚪
- [ ] Custom notification preferences
- [ ] Export data as CSV
- [ ] Multi-language support
- [ ] Accessibility audit`,

  "DASHBOARD.md": `# Fanvue Ops Dashboard

## Design System

### Colors
- Primary: #71ba57 (Fanvue Green)
- Background: Dark mode default (#0a0a1a)
- Cards: Semi-transparent with subtle borders
- Accent: Emerald for success, Amber for warnings

### Typography
- Headings: Geist Sans Bold
- Body: Geist Sans Regular
- Code: Geist Mono

### Components
All components use shadcn/ui with custom Fanvue theming.

## Architecture

### Frontend
- Next.js 16 with App Router
- Tailwind CSS 4
- shadcn/ui component library
- Recharts for data visualization
- Zustand for state management

### Backend
- API Routes for server-side logic
- Prisma ORM with SQLite
- Fanvue API proxy
- GitHub Contents API integration
- z-ai-web-dev-sdk for AELIANA AI`,
};

export function RepoBrowserSection() {
  const [files, setFiles] = useState<RepoFile[]>(DEMO_FILES);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchFileContent = async (path: string) => {
    setSelectedFile(path);
    setLoading(true);

    if (DEMO_CONTENT[path]) {
      setFileContent(DEMO_CONTENT[path]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/github/${path}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || JSON.stringify(data, null, 2));
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Failed to fetch file content");
    }
    setFileContent("# File content will appear here once fetched from the repository.\n\n*This is a preview — connect GitHub to see real file contents.*");
    setLoading(false);
  };

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
      if (path === "output") {
        setFiles([...DEMO_FILES.filter((f) => f.type === "file"), ...DEMO_OUTPUT_FILES]);
      }
    }
    setExpandedDirs(newExpanded);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repo Browser</h1>
          <p className="text-muted-foreground text-sm">
            Navigate and read files from iaofteam-crypto/fanvue_ops
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFiles(DEMO_FILES);
            setSelectedFile(null);
            setFileContent("");
          }}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Tree */}
        <Card className="bg-card/50 border-border/50 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              fanvue_ops
              <Badge variant="outline" className="text-xs ml-auto">
                main
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[calc(100vh-18rem)]">
              <div className="py-1">
                {files.map((file) => (
                  <div key={file.path}>
                    {file.type === "dir" ? (
                      <button
                        onClick={() => toggleDir(file.path)}
                        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        {expandedDirs.has(file.path) ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                        <FolderOpen className="w-4 h-4 text-amber-400" />
                        <span className="text-sm">{file.name}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => fetchFileContent(file.path)}
                        className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left ${
                          selectedFile === file.path ? "bg-muted" : ""
                        }`}
                      >
                        <span className="w-3" />
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(file.size)}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* File Content */}
        <Card className="bg-card/50 border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {selectedFile || "Select a file to view"}
              {selectedFile && (
                <div className="ml-auto flex items-center gap-1">
                  <a
                    href={`https://github.com/iaofteam-crypto/fanvue_ops/blob/main/${encodeURIComponent(selectedFile)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on GitHub"
                  >
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { setSelectedFile(null); setFileContent(""); }} aria-label="Close file">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedFile ? (
              <ScrollArea className="max-h-[calc(100vh-22rem)]">
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                  {fileContent}
                </pre>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a file from the tree to view its contents</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
