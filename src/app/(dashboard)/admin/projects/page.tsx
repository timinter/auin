"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { getApiError } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function handleCreate() {
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      toast({ title: "Project created" });
      setDialogOpen(false);
      setNewName("");
      loadProjects();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  async function handleEdit() {
    if (!editingProject) return;
    const res = await fetch("/api/admin/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingProject.id, name: editName }),
    });
    if (res.ok) {
      toast({ title: "Project updated" });
      setEditingProject(null);
      loadProjects();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  async function toggleStatus(project: Project) {
    const newStatus = project.status === "active" ? "archived" : "active";
    const res = await fetch("/api/admin/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, status: newStatus }),
    });
    if (res.ok) {
      toast({ title: `Project ${newStatus}` });
      loadProjects();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Project deleted" });
      loadProjects();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Add a new project for freelancer assignments.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter><Button onClick={handleCreate} disabled={!newName}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProject} onOpenChange={(open) => { if (!open) setEditingProject(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Rename the project.</DialogDescription>
          </DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter><Button onClick={handleEdit} disabled={!editName}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={3}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : projects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell><Badge variant={p.status === "active" ? "success" : "secondary"}>{p.status}</Badge></TableCell>
              <TableCell className="text-right">
                <TooltipProvider delayDuration={300}>
                  <div className="inline-flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProject(p); setEditName(p.name); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${p.status === "active" ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
                          onClick={() => toggleStatus(p)}
                        >
                          {p.status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{p.status === "active" ? "Archive" : "Activate"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
