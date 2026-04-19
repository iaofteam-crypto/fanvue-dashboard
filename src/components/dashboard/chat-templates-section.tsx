"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Eye,
  Edit3,
  Copy,
  Search,
  ArrowLeft,
  X,
  RefreshCw,
  FileText,
  BookTemplate,
  MessageSquare,
  Tag,
  BarChart3,
  TrendingUp,
  DollarSign,
  ImageIcon,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatTemplate {
  id: string;
  uuid: string;
  name: string;
  content: string;
  category: ChatTemplateCategory;
  mediaUuids?: string[];
  ppvPrice?: number;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

type ChatTemplateCategory = "greeting" | "ppv_offer" | "re_engagement" | "thank_you" | "custom";

type ViewMode = "overview" | "create" | "edit" | "preview";

// ─── Constants ──────────────────────────────────────────────────────────────

const TEMPLATE_VARIABLES = [
  { name: "{{fan_name}}", description: "Fan's display name" },
  { name: "{{creator_name}}", description: "Your display name" },
  { name: "{{tier}}", description: "Fan's subscription tier" },
  { name: "{{days_since_sub}}", description: "Days since subscription" },
] as const;

const CATEGORY_CONFIG: Record<ChatTemplateCategory, { label: string; color: string; bgColor: string; borderColor: string }> = {
  greeting: {
    label: "Greeting",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
  },
  ppv_offer: {
    label: "PPV Offer",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  re_engagement: {
    label: "Re-Engagement",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
  thank_you: {
    label: "Thank You",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  custom: {
    label: "Custom",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border/50",
  },
};

// ─── Demo Data ──────────────────────────────────────────────────────────────

function generateDemoTemplates(): ChatTemplate[] {
  const now = new Date();
  const dayMs = 86400000;

  return [
    {
      id: "tpl-1",
      uuid: "ct-uuid-0001",
      name: "Welcome New Subscriber",
      content: "Hey {{fan_name}}! Welcome to my page — I'm so excited to have you here! As a {{tier}} subscriber, you get access to all my exclusive content. Let me know what you'd love to see more of! 💖",
      category: "greeting",
      mediaUuids: [],
      createdAt: new Date(now.getTime() - 14 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
      usageCount: 47,
    },
    {
      id: "tpl-2",
      uuid: "ct-uuid-0002",
      name: "Exclusive Photo Set PPV",
      content: "Hey {{fan_name}}! I just dropped an exclusive new photo set that I think you'll love. 15 never-before-seen shots from my latest studio session. This one's my favorite set yet! 📸✨",
      category: "ppv_offer",
      mediaUuids: ["media-ppv-001", "media-ppv-002"],
      ppvPrice: 12.99,
      createdAt: new Date(now.getTime() - 10 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
      usageCount: 32,
    },
    {
      id: "tpl-3",
      uuid: "ct-uuid-0003",
      name: "Win-Back Inactive Fan",
      content: "Hey {{fan_name}}! It's been a little while — I've missed chatting with you! I've got some amazing new content coming up that I think you'll really enjoy. Hope to see you around more! 💕",
      category: "re_engagement",
      mediaUuids: [],
      createdAt: new Date(now.getTime() - 20 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * dayMs).toISOString(),
      usageCount: 18,
    },
    {
      id: "tpl-4",
      uuid: "ct-uuid-0004",
      name: "Thank You for Tip",
      content: "{{fan_name}}, thank you SO much for the generous tip! Your support means the world to me. It really motivates me to keep creating content you love. You're amazing! 🙏✨",
      category: "thank_you",
      mediaUuids: [],
      createdAt: new Date(now.getTime() - 7 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 7 * dayMs).toISOString(),
      usageCount: 63,
    },
    {
      id: "tpl-5",
      uuid: "ct-uuid-0005",
      name: "Premium Video Offer",
      content: "Hey {{fan_name}}! I just finished editing a special video I made just for my {{tier}} subscribers. It's about 12 minutes of exclusive behind-the-scenes content you won't find anywhere else. Want me to send it your way? 🎬",
      category: "ppv_offer",
      mediaUuids: ["media-vid-001"],
      ppvPrice: 19.99,
      createdAt: new Date(now.getTime() - 5 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
      usageCount: 24,
    },
    {
      id: "tpl-6",
      uuid: "ct-uuid-0006",
      name: "Milestone Thank You",
      content: "Hey {{fan_name}}! Can you believe it's been {{days_since_sub}} days since you subscribed? Having you here has been incredible. Thank you for being one of my most loyal supporters! 🎉💚",
      category: "thank_you",
      mediaUuids: [],
      createdAt: new Date(now.getTime() - 3 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * dayMs).toISOString(),
      usageCount: 15,
    },
    {
      id: "tpl-7",
      uuid: "ct-uuid-0007",
      name: "Personalized Greeting",
      content: "Hi {{fan_name}}! Thanks for subscribing at the {{tier}} tier. I noticed you've been here for {{days_since_sub}} days now — hope you're enjoying everything! Don't hesitate to message me anytime. 😊",
      category: "greeting",
      mediaUuids: [],
      createdAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
      usageCount: 38,
    },
    {
      id: "tpl-8",
      uuid: "ct-uuid-0008",
      name: "Weekend Special Promo",
      content: "Hey {{fan_name}}! I'm running a special this weekend — 30% off my entire PPV catalog for {{tier}} members. Use this chance to grab any sets you've been eyeing! Limited time only 🔥",
      category: "custom",
      mediaUuids: ["media-promo-001"],
      ppvPrice: 7.99,
      createdAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
      usageCount: 9,
    },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function highlightVariables(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key} className="text-sky-400 font-medium bg-sky-500/10 px-0.5 rounded">
        {match[0]}
      </span>
    );
    key++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function previewSnippet(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatTemplatesSection({ connected }: { connected: boolean }) {
  // Data state
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ChatTemplateCategory>("greeting");
  const [formContent, setFormContent] = useState("");
  const [formMediaUuids, setFormMediaUuids] = useState("");
  const [formPpvPrice, setFormPpvPrice] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ChatTemplateCategory | "all">("all");

  // Show variables panel
  const [showVariables, setShowVariables] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Derived
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // ─── Load templates ─────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fanvue/chat-templates");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.templates || [];
        if (list.length > 0) {
          setTemplates(list as ChatTemplate[]);
          setLoading(false);
          return;
        }
      }
    } catch {
      // silent — fall through to demo data
    }
    setTemplates(generateDemoTemplates());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─── Filtered templates ─────────────────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = !searchQuery
        || t.name.toLowerCase().includes(searchQuery.toLowerCase())
        || t.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  // ─── Category counts ────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, [templates]);

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalTemplates = templates.length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);

    // Most used category
    const categoryUsage: Record<string, number> = {};
    for (const t of templates) {
      categoryUsage[t.category] = (categoryUsage[t.category] || 0) + t.usageCount;
    }
    let mostUsedCategory: ChatTemplateCategory = "greeting";
    let maxUsage = 0;
    for (const [cat, usage] of Object.entries(categoryUsage)) {
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsedCategory = cat as ChatTemplateCategory;
      }
    }

    // Created this week
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const createdThisWeek = templates.filter((t) => new Date(t.createdAt) >= weekAgo).length;

    return { totalTemplates, mostUsedCategory, totalUsage, createdThisWeek };
  }, [templates]);

  // ─── Form helpers ───────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName("");
    setFormCategory("greeting");
    setFormContent("");
    setFormMediaUuids("");
    setFormPpvPrice("");
  };

  const loadFormFromTemplate = (template: ChatTemplate) => {
    setFormName(template.name);
    setFormCategory(template.category);
    setFormContent(template.content);
    setFormMediaUuids(template.mediaUuids?.join(", ") ?? "");
    setFormPpvPrice(template.ppvPrice?.toString() ?? "");
  };

  const canSave = formName.trim().length > 0 && formContent.trim().length > 0;

  // ─── Create template ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canSave) return;
    setFormSaving(true);
    try {
      const newTemplate: ChatTemplate = {
        id: `tpl-${Date.now()}`,
        uuid: `ct-uuid-${Date.now()}`,
        name: formName.trim(),
        content: formContent.trim(),
        category: formCategory,
        mediaUuids: formMediaUuids
          ? formMediaUuids.split(",").map((u) => u.trim()).filter((u) => u.length > 0)
          : [],
        ppvPrice: formPpvPrice ? parseFloat(formPpvPrice) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
      };

      // Try API
      try {
        const res = await fetch("/api/fanvue/chat-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newTemplate.name,
            content: newTemplate.content,
            category: newTemplate.category,
            mediaUuids: newTemplate.mediaUuids,
            ppvPrice: newTemplate.ppvPrice,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.id || data?.uuid) {
            setTemplates((prev) => [{ ...newTemplate, id: data.id || newTemplate.id, uuid: data.uuid || newTemplate.uuid }, ...prev]);
            toast.success(`Template "${newTemplate.name}" created`);
            setViewMode("overview");
            resetForm();
            return;
          }
        }
      } catch {
        // fall through to local
      }

      // Local only
      setTemplates((prev) => [newTemplate, ...prev]);
      toast.success(`Template "${newTemplate.name}" created`);
      setViewMode("overview");
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create template";
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  // ─── Update template ────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!canSave || !selectedTemplateId) return;
    setFormSaving(true);
    try {
      const updates = {
        name: formName.trim(),
        content: formContent.trim(),
        category: formCategory,
        mediaUuids: formMediaUuids
          ? formMediaUuids.split(",").map((u) => u.trim()).filter((u) => u.length > 0)
          : [],
        ppvPrice: formPpvPrice ? parseFloat(formPpvPrice) : undefined,
        updatedAt: new Date().toISOString(),
      };

      // Try API
      try {
        const res = await fetch(`/api/fanvue/chat-templates/${selectedTemplateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...updates } : t))
          );
          toast.success(`Template "${formName.trim()}" updated`);
          setViewMode("overview");
          setSelectedTemplateId(null);
          resetForm();
          return;
        }
      } catch {
        // fall through to local
      }

      // Local only
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...updates } : t))
      );
      toast.success(`Template "${formName.trim()}" updated`);
      setViewMode("overview");
      setSelectedTemplateId(null);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update template";
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  // ─── Delete template ────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setDeletingId(id);
    try {
      try {
        await fetch(`/api/fanvue/chat-templates/${id}`, { method: "DELETE" });
      } catch {
        // silent — local fallback
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setViewMode("overview");
      }
      toast.success(`Template "${template.name}" deleted`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete template";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Copy to clipboard ──────────────────────────────────────────────────

  const handleCopy = async (template: ChatTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content);
      toast.success("Template copied to clipboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to copy";
      toast.error(msg);
    }
  };

  // ─── Duplicate template ─────────────────────────────────────────────────

  const handleDuplicate = (template: ChatTemplate) => {
    const dup: ChatTemplate = {
      ...template,
      id: `tpl-${Date.now()}`,
      uuid: `ct-uuid-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };
    setTemplates((prev) => [dup, ...prev]);
    toast.success(`Duplicated "${template.name}"`);
  };

  // ─── Navigate ───────────────────────────────────────────────────────────

  const startCreate = () => {
    resetForm();
    setViewMode("create");
  };

  const startEdit = (template: ChatTemplate) => {
    loadFormFromTemplate(template);
    setSelectedTemplateId(template.id);
    setViewMode("edit");
  };

  const startPreview = (template: ChatTemplate) => {
    setSelectedTemplateId(template.id);
    setViewMode("preview");
  };

  const goBack = () => {
    setViewMode("overview");
    setSelectedTemplateId(null);
  };

  // ─── Disconnected state ─────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookTemplate className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Chat Templates unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to manage templates</p>
      </div>
    );
  }

  // ─── Preview View ───────────────────────────────────────────────────────

  if (viewMode === "preview" && selectedTemplate) {
    const catConfig = CATEGORY_CONFIG[selectedTemplate.category];

    return (
      <div className="space-y-6">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to templates
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{selectedTemplate.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Created {formatRelativeDate(selectedTemplate.createdAt)} · Updated {formatRelativeDate(selectedTemplate.updatedAt)}
            </p>
          </div>
          <Badge variant="outline" className={`${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor}`}>
            {catConfig.label}
          </Badge>
        </div>

        {/* Rendered Preview */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Template Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {highlightVariables(selectedTemplate.content)}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor}`}>
                <Tag className="w-3 h-3 mr-1" />
                {catConfig.label}
              </Badge>
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                <MessageSquare className="w-3 h-3 mr-1" />
                Used {selectedTemplate.usageCount} times
              </Badge>
              {selectedTemplate.mediaUuids && selectedTemplate.mediaUuids.length > 0 && (
                <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20">
                  <ImageIcon className="w-3 h-3 mr-1" />
                  {selectedTemplate.mediaUuids.length} media attached
                </Badge>
              )}
              {selectedTemplate.ppvPrice && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                  <DollarSign className="w-3 h-3 mr-1" />
                  PPV ${selectedTemplate.ppvPrice.toFixed(2)}
                </Badge>
              )}
            </div>

            {/* Variables used */}
            {selectedTemplate.content.includes("{{") && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Variables in this template:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.filter((v) => selectedTemplate.content.includes(v.name)).map((v) => (
                    <Badge key={v.name} variant="outline" className="text-xs bg-sky-500/10 text-sky-400 border-sky-500/20">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {v.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => startEdit(selectedTemplate)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => handleCopy(selectedTemplate)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" onClick={() => handleDuplicate(selectedTemplate)}>
            <FileText className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDelete(selectedTemplate.id)}
            disabled={deletingId === selectedTemplate.id}
            className="text-destructive ml-auto"
          >
            {deletingId === selectedTemplate.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete
          </Button>
        </div>
      </div>
    );
  }

  // ─── Create / Edit View ─────────────────────────────────────────────────

  if (viewMode === "create" || viewMode === "edit") {
    const isEditing = viewMode === "edit";
    const catConfig = CATEGORY_CONFIG[formCategory];

    return (
      <div className="space-y-6">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to templates
        </button>

        <div>
          <h2 className="text-xl font-bold">{isEditing ? "Edit Template" : "Create New Template"}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isEditing ? "Update your message template" : "Design a reusable message template with dynamic variables"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 space-y-4">
              {/* Name */}
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Template Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Welcome Message"
                  maxLength={100}
                />
                <div className="flex justify-end text-xs text-muted-foreground mt-1">
                  {formName.length}/100
                </div>
              </div>

              {/* Category */}
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Category</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as ChatTemplateCategory[]).map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const isActive = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          isActive
                            ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`
                            : "border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium">Content</Label>
                  <button
                    type="button"
                    onClick={() => setShowVariables(!showVariables)}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    {showVariables ? "Hide Variables" : "Show Variables"}
                  </button>
                </div>
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write your template content... Use {{fan_name}} for dynamic variables."
                  className="min-h-[120px] resize-y"
                  maxLength={1000}
                />
                <div className="flex justify-end text-xs text-muted-foreground mt-1">
                  {formContent.length}/1000
                </div>

                {/* Variables panel */}
                {showVariables && (
                  <div className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-sky-400">Available Variables</p>
                    <p className="text-xs text-muted-foreground">Click to insert into your template</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => {
                            setFormContent((prev) => prev + v.name);
                          }}
                          className="px-2 py-1 rounded border border-sky-500/20 bg-sky-500/10 text-xs text-sky-400 hover:bg-sky-500/20 transition-colors"
                          title={v.description}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <div key={v.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <code className="text-sky-400 text-[11px]">{v.name}</code>
                          <span>— {v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Media UUIDs */}
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Media UUIDs (optional)</Label>
                <Input
                  value={formMediaUuids}
                  onChange={(e) => setFormMediaUuids(e.target.value)}
                  placeholder="Comma-separated UUIDs, e.g. uuid-1, uuid-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Attach media files by their UUIDs</p>
              </div>

              {/* PPV Price */}
              <div>
                <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  PPV Price (optional, min $2)
                </Label>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    value={formPpvPrice}
                    onChange={(e) => setFormPpvPrice(e.target.value)}
                    placeholder="9.99"
                    className="pl-7"
                    min="2"
                    step="0.50"
                  />
                </div>
                {formPpvPrice && parseFloat(formPpvPrice) > 0 && parseFloat(formPpvPrice) < 2 && (
                  <p className="text-xs text-red-400 mt-1">Minimum PPV price is $2.00</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          {canSave && (
            <Card className="bg-card/50 border-border/50 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{formName || "Untitled Template"}</p>
                  <Badge variant="outline" className={`${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor} text-[10px]`}>
                    {catConfig.label}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {formContent.trim() ? highlightVariables(formContent.trim()) : (
                      <span className="text-muted-foreground italic">Start typing to see a preview...</span>
                    )}
                  </p>
                </div>
                {formMediaUuids.trim() && (
                  <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {formMediaUuids.split(",").filter((u) => u.trim()).length} media attached
                  </Badge>
                )}
                {formPpvPrice && parseFloat(formPpvPrice) >= 2 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                    <DollarSign className="w-3 h-3 mr-1" />
                    PPV ${parseFloat(formPpvPrice).toFixed(2)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={goBack}>Cancel</Button>
          <Button
            onClick={isEditing ? handleUpdate : handleCreate}
            disabled={!canSave || formSaving || (formPpvPrice ? parseFloat(formPpvPrice) > 0 && parseFloat(formPpvPrice) < 2 : false)}
          >
            {formSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : isEditing ? (
              <><Edit3 className="w-4 h-4 mr-2" />Update Template</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" />Create Template</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Overview View ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chat Templates</h1>
          <p className="text-muted-foreground text-sm">
            Create reusable message templates with dynamic variables
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              Total Templates
            </div>
            <p className="text-xl font-bold mt-1">{stats.totalTemplates}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              Most Used Category
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={`${CATEGORY_CONFIG[stats.mostUsedCategory].bgColor} ${CATEGORY_CONFIG[stats.mostUsedCategory].color} ${CATEGORY_CONFIG[stats.mostUsedCategory].borderColor} text-xs`}>
                {CATEGORY_CONFIG[stats.mostUsedCategory].label}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" />
              Total Usage
            </div>
            <p className="text-xl font-bold mt-1">{stats.totalUsage}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Created This Week
            </div>
            <p className="text-xl font-bold mt-1">{stats.createdThisWeek}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTemplates}
          disabled={loading}
          className="flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            categoryFilter === "all"
              ? "bg-primary/10 text-primary border-primary/20"
              : "border-border/50 text-muted-foreground hover:border-border"
          }`}
        >
          All ({categoryCounts.all ?? 0})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as ChatTemplateCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isActive
                  ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`
                  : "border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              {cfg.label} ({categoryCounts[cat] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookTemplate className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-medium text-sm">
              {searchQuery || categoryFilter !== "all" ? "No templates match your filters" : "No templates yet"}
            </p>
            <p className="text-xs mt-1">
              {searchQuery || categoryFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first template to get started"}
            </p>
            {!searchQuery && categoryFilter === "all" && (
              <Button variant="outline" size="sm" className="mt-3" onClick={startCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const catConfig = CATEGORY_CONFIG[template.category];
            return (
              <Card
                key={template.id}
                className="bg-card/50 border-border/50 hover:border-border transition-colors group"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{template.name}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor} text-[10px]`}
                      >
                        {catConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => startPreview(template)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(template)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(template)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Duplicate"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {previewSnippet(template.content, 80)}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {template.usageCount}
                      </span>
                      {template.mediaUuids && template.mediaUuids.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {template.mediaUuids.length}
                        </span>
                      )}
                      {template.ppvPrice && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          ${template.ppvPrice.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <span>{formatRelativeDate(template.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
