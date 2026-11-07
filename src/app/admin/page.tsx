"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Building,
  Wrench,
  Search,
  CheckCircle2,
  RefreshCw,
  Plus,
  Phone,
  Mail,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Check,
  CheckCheck,
  Send,
  Loader2,
  Lock,
  LogOut,
  AlertTriangle,
  KeyRound,
  ArrowRight,
  ArrowUpRight,
  Pen,
  LayoutGrid,
  Trash2,
  Edit3,
  Layers,
  Home,
  Building2,
  BedDouble,
  GraduationCap,
  Landmark,
  Dumbbell,
  Coffee,
  Trees,
  Laptop,
  Stethoscope,
  Bus,
  BookOpen,
  Store,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  X,
  MessageSquare,
  Archive,
  Clock,
  History,
  RotateCcw,
  Camera,
  MessageCircle,
} from "lucide-react";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import EvidencePhotosGallery from "@/components/EvidencePhotosGallery";
import { clearStoredTickets } from "@/lib/storage/ticketStorage";
import { sortComplaintsByOperationalPriority } from "@/lib/queue/sorting";

const CATEGORY_ICON_OPTIONS = [
  { id: "Home", label: "Residential Housing", icon: Home },
  { id: "Building2", label: "Student Hostels", icon: Building2 },
  { id: "GraduationCap", label: "Academic & Labs", icon: GraduationCap },
  { id: "Landmark", label: "Central Facilities", icon: Landmark },
  { id: "BedDouble", label: "Guest House / Dorms", icon: BedDouble },
  { id: "Dumbbell", label: "Sports & Gymnasium", icon: Dumbbell },
  { id: "Coffee", label: "Dining & Canteen", icon: Coffee },
  { id: "Trees", label: "Gardens & Grounds", icon: Trees },
  { id: "Laptop", label: "IT & Computing", icon: Laptop },
  { id: "Stethoscope", label: "Health Centre", icon: Stethoscope },
  { id: "BookOpen", label: "Library & Studies", icon: BookOpen },
  { id: "Store", label: "Commercial Arcade", icon: Store },
  { id: "Wrench", label: "Workshops & Works", icon: Wrench },
  { id: "Bus", label: "Transit & Shuttles", icon: Bus },
  { id: "Sparkles", label: "Special Amenities", icon: Sparkles },
];

const ALL_AVAILABLE_DOMAINS = [
  { id: "Electrical", label: "Electrical Works", desc: "Fans, lights, MCBs, wiring" },
  { id: "Civil", label: "Civil & Masonry", desc: "Seepage, plaster, tiles, glass" },
  { id: "Plumbing", label: "Plumbing & Sanitary", desc: "Taps, pipelines, geysers, flush" },
  { id: "Air-Conditioning", label: "Air-Conditioning", desc: "Split ACs, remotes, servicing" },
  { id: "Water-Cooler", label: "Water Coolers", desc: "Cooling units, purifiers, taps" },
  { id: "Carpentry", label: "Carpentry & Furniture", desc: "Doors, locks, desks, cupboards" },
  { id: "Network/IT", label: "Network & IT", desc: "LAN ports, Wi-Fi access points" },
];

const LOCATION_TYPE_OPTIONS = [
  {
    id: "apartment",
    title: "Residential Apartments",
    desc: "Resident enters block & flat unit number (e.g. 01/101)",
    icon: Home,
  },
  {
    id: "hostel",
    title: "Student Hostels",
    desc: "Resident selects hostel block (Aibaan, Chimair, etc.) and room number",
    icon: Building2,
  },
  {
    id: "academic",
    title: "Academic Complex & Labs",
    desc: "Resident selects academic block (AB 1-4, Library) and room/lab number",
    icon: GraduationCap,
  },
  {
    id: "general",
    title: "General Campus Location",
    desc: "Resident provides written location details (room, ground, corridor, or shop)",
    icon: Landmark,
  },
];

const getCategoryIconComponent = (iconName: string) => {
  const match = CATEGORY_ICON_OPTIONS.find((opt) => opt.id === iconName);
  return match ? match.icon : Home;
};

function parseCommentContent(rawMessage: string) {
  if (!rawMessage) return { text: "", images: [] as { url: string; name: string }[] };

  const imgRegex = /\[ATTACHMENT_IMG:([^|]+)\|([^\]]*)\]/g;
  const images: { url: string; name: string }[] = [];
  let match;

  while ((match = imgRegex.exec(rawMessage)) !== null) {
    images.push({
      url: match[1],
      name: decodeURIComponent(match[2] || "Photo Attachment"),
    });
  }

  const cleanText = rawMessage.replace(imgRegex, "").trim();
  return { text: cleanText, images };
}

export default function AdminPortalPage() {
  const router = useRouter();
  // Session & User State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [demoProfiles, setDemoProfiles] = useState<any[]>([]);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "requests" | "roles" | "users" | "departments" | "categories" | "archived" | "calendar"
  >("requests");

  // Categories Management State (Overall Admin)
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    slug: string;
    shortDescription: string;
    icon: string;
    locationType: "apartment" | "hostel" | "academic" | "general";
    hasCorridor: boolean;
    allowedDomains: string[];
    active: boolean;
  }>({
    name: "",
    slug: "",
    shortDescription: "",
    icon: "Home",
    locationType: "general",
    hasCorridor: false,
    allowedDomains: ["Electrical", "Civil", "Plumbing"],
    active: true,
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);
  const [categoryActionSuccess, setCategoryActionSuccess] = useState<string | null>(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<any | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Requests Data & Filters
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Request Drawer
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [staffNoteText, setStaffNoteText] = useState("");
  const [staffNotePhotos, setStaffNotePhotos] = useState<
    { name: string; size: number; type: string; url: string }[]
  >([]);
  const [isPostingStaffNote, setIsPostingStaffNote] = useState(false);
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [isDeletingAdminRequest, setIsDeletingAdminRequest] = useState(false);
  // Lightbox Image Gallery state (Full view with zoom, pan, drawing & back-button support)
  const [adminLightboxGallery, setAdminLightboxGallery] = useState<{
    images: { url: string; name: string }[];
    initialIndex: number;
  } | null>(null);
  const [annotatingStaffPhotoIdx, setAnnotatingStaffPhotoIdx] = useState<number | null>(null);

  const openAdminLightbox = (images: { url: string; name: string }[], initialIndex: number = 0) => {
    setAdminLightboxGallery({ images, initialIndex });
  };

  // Unread tracker for Small Chat in Admin Drawer
  const [adminFirstUnreadId, setAdminFirstUnreadId] = useState<string | null>(null);
  const adminFollowUpContainerRef = useRef<HTMLDivElement>(null);

  // Secondary DB Purge State (Overall Admin only)
  const [showPurgeArchivedModal, setShowPurgeArchivedModal] = useState(false);
  const [isPurgingArchived, setIsPurgingArchived] = useState(false);

  // Secondary Archival DB State
  const [archivedRequests, setArchivedRequests] = useState<any[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isSweepingLifecycle, setIsSweepingLifecycle] = useState(false);
  const [sweepResult, setSweepResult] = useState<any | null>(null);
  const [selectedArchivedRequest, setSelectedArchivedRequest] = useState<any | null>(null);

  // Department staff for assignments
  const [deptStaffList, setDeptStaffList] = useState<any[]>([]);

  // Staff unassigned visibility toggle & queue filter
  const [allowStaffViewUnassigned, setAllowStaffViewUnassigned] = useState(true);
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState(false);

  // Roles Schema State
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<any | null>(null);
  const [editedRolePermissions, setEditedRolePermissions] = useState<string[]>([]);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState<string | null>(null);

  // Users Directory State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    phone: "",
    roleId: "",
    departmentId: "",
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [userDeptFilter, setUserDeptFilter] = useState<string>("ALL");

  // Authentication State
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load Session and Demo Profiles (NO auto-login for incognito/anonymous)
  const loadSession = async () => {
    setIsSessionLoading(true);
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user || null);
        setDemoProfiles(data.demoProfiles || []);
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    } finally {
      setIsSessionLoading(false);
    }
  };

  // Explicit Login Handler
  const handleLogin = async (e?: React.FormEvent, directEmail?: string) => {
    if (e) e.preventDefault();
    const emailToUse = directEmail || loginEmail.trim();
    if (!emailToUse) {
      setLoginError("Please enter your official IITGN staff email.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
      });
      const data = await res.json();
      if (data.success) {
        await loadSession();
      } else {
        setLoginError(data.error || "Authentication failed. Check your staff credentials.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Explicit Logout Handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setCurrentUser(null);
      setRequests([]);
      setAllUsers([]);
      setRoles([]);
      clearStoredTickets();
    } catch (e) {
      console.error("Logout error:", e);
      clearStoredTickets();
    }
  };

  // Switch Active User Role (when authenticated)
  const handleSwitchProfile = async (email: string) => {
    setIsSwitchingProfile(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        await loadSession();
      }
    } catch (e) {
      console.error("Error switching profile:", e);
    } finally {
      setIsSwitchingProfile(false);
    }
  };

  // Fetch Requests (enforces role & department filtering)
  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      let url = `/api/requests?staffView=true&`;
      if (selectedStatusFilter !== "ALL") url += `status=${selectedStatusFilter}&`;
      if (selectedPriorityFilter !== "ALL") url += `priority=${selectedPriorityFilter}&`;
      if (selectedDeptFilter !== "ALL") url += `departmentId=${selectedDeptFilter}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery)}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to fetch requests:", e);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Fetch Options & Departments
  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/options");
      const data = await res.json();
      if (data.success) {
        setDepartments(data.departments || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Roles & Permissions
  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (data.success) {
        setRoles(data.roles || []);
        setAllPermissions(data.allPermissions || []);
        if (data.roles?.length > 0 && !selectedRoleForEdit) {
          setSelectedRoleForEdit(data.roles[1]); // default to Dept Admin
          setEditedRolePermissions(data.roles[1].permissions || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.users || []);
        setDeptStaffList(data.users.filter((u: any) => u.role?.level === 3));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Complaint Categories
  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success) {
        setCategoriesList(data.categories || []);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      slug: "",
      shortDescription: "",
      icon: "Home",
      locationType: "general",
      hasCorridor: false,
      allowedDomains: ["Electrical", "Civil", "Plumbing"],
      active: true,
    });
    setCategoryActionError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      slug: cat.slug,
      shortDescription: cat.shortDescription,
      icon: cat.icon || "Home",
      locationType: cat.locationType || "general",
      hasCorridor: Boolean(cat.hasCorridor),
      allowedDomains: Array.isArray(cat.allowedDomains)
        ? cat.allowedDomains
        : ["Electrical", "Civil", "Plumbing"],
      active: cat.active !== false,
    });
    setCategoryActionError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryActionError("Please enter a category name (e.g. Sports Complex).");
      return;
    }
    if (categoryForm.allowedDomains.length === 0) {
      setCategoryActionError("Please select at least one maintenance trade.");
      return;
    }

    setIsSavingCategory(true);
    setCategoryActionError(null);

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id || editingCategory.slug}`
        : "/api/categories";
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save category.");
      }

      setCategoryActionSuccess(data.message || "Complaint zone saved successfully!");
      setTimeout(() => setCategoryActionSuccess(null), 4000);
      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setCategoryActionError(err.message || "Failed to save complaint zone.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat: any) => {
    try {
      const newActive = !cat.active;
      const res = await fetch(`/api/categories/${cat.id || cat.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      const data = await res.json();
      if (data.success) {
        setCategoryActionSuccess(`"${cat.name}" is now ${newActive ? "Active" : "Inactive"}.`);
        setTimeout(() => setCategoryActionSuccess(null), 3000);
        fetchCategories();
      }
    } catch (err) {
      console.error("Failed to toggle category active:", err);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirmCategory) return;
    setIsDeletingCategory(true);
    try {
      const res = await fetch(
        `/api/categories/${deleteConfirmCategory.id || deleteConfirmCategory.slug}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete category.");
      }
      setCategoryActionSuccess(data.message || "Category removed successfully.");
      setTimeout(() => setCategoryActionSuccess(null), 4000);
      setDeleteConfirmCategory(null);
      fetchCategories();
    } catch (err: any) {
      setCategoryActionError(err.message || "Could not delete category.");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  useEffect(() => {
    loadSession();
    fetchOptions();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
      fetchRoles();
      fetchUsers();
      fetchCategories();
      fetchSettings();
    }
  }, [selectedDeptFilter, selectedStatusFilter, selectedPriorityFilter, currentUser]);

  // Handle Role Selection for Editing Permissions
  const handleSelectRole = (r: any) => {
    setSelectedRoleForEdit(r);
    setEditedRolePermissions(r.permissions || []);
    setRoleSaveSuccess(null);
  };

  // Toggle Permission Checkbox
  const handleTogglePermission = (permCode: string) => {
    setEditedRolePermissions((prev) =>
      prev.includes(permCode)
        ? prev.filter((p) => p !== permCode)
        : [...prev, permCode]
    );
  };

  // Save Role Permissions Schema
  const handleSaveRolePermissions = async () => {
    if (!selectedRoleForEdit) return;
    setIsSavingRole(true);
    setRoleSaveSuccess(null);

    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleForEdit.id,
          permissionCodes: editedRolePermissions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRoleSaveSuccess(`Saved permissions for ${selectedRoleForEdit.name}!`);
        fetchRoles();
      } else {
        alert(data.error || "Failed to update role schema");
      }
    } catch (e: any) {
      alert(e.message || "Failed to save permissions.");
    } finally {
      setIsSavingRole(false);
    }
  };

  // Fetch Staff Visibility Settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setAllowStaffViewUnassigned(data.settings.allowStaffViewUnassigned !== false);
      }
    } catch (e) {
      console.error("Failed to fetch settings:", e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Toggle whether field staff can view unassigned pool tasks
  const handleToggleStaffViewUnassigned = async () => {
    const nextVal = !allowStaffViewUnassigned;
    setAllowStaffViewUnassigned(nextVal);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "allow_staff_view_unassigned", value: String(nextVal) }),
      });
      const data = await res.json();
      if (!data.success) {
        setAllowStaffViewUnassigned(!nextVal);
        alert(data.error || "Failed to update setting");
      } else {
        fetchRequests();
      }
    } catch (e) {
      setAllowStaffViewUnassigned(!nextVal);
    }
  };

  // Change Complaint Priority on the fly from Complaints Queue table
  const handlePriorityChange = async (requestId: string, newPriority: string) => {
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        setRequests((prev) =>
          prev.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  priority: newPriority,
                  isUrgent: newPriority === "HIGH" || newPriority === "EMERGENCY",
                }
              : item
          )
        );
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest((prev: any) => ({
            ...prev,
            priority: newPriority,
            isUrgent: newPriority === "HIGH" || newPriority === "EMERGENCY",
          }));
        }
      } else {
        alert(data.error || "Failed to update priority");
      }
    } catch (e) {
      console.error("Priority update error:", e);
    }
  };

  // Quick Technician Assignment from Table
  const handleQuickAssignTechnician = async (requestId: string, staffId: string) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staffId || null }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        setRequests((prev) =>
          prev.map((item) => (item.id === requestId ? { ...item, ...data.request } : item))
        );
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest((prev: any) => ({
            ...prev,
            ...data.request,
          }));
        }
      } else {
        alert(data.error || "Failed to assign technician");
      }
    } catch (e) {
      console.error("Assign error:", e);
    }
  };

  // Escalate Complaint from Admin/Staff console
  const handleStaffEscalate = async (requestId: string) => {
    const reason = prompt(
      "Enter reason for escalation (e.g. requires specialized vendor, structural repairs, or senior engineer intervention):"
    );
    if (!reason || !reason.trim()) return;

    setIsUpdatingAction(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason.trim() }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        alert(`Complaint successfully escalated to ${data.message || `Tier ${data.escalationLevel}`}`);
        setRequests((prev) =>
          prev.map((item) => (item.id === requestId ? { ...item, ...data.request } : item))
        );
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest(data.request);
        }
      } else {
        alert(data.error || "Failed to escalate ticket.");
      }
    } catch (e) {
      console.error("Staff escalation error:", e);
    } finally {
      setIsUpdatingAction(false);
    }
  };

  // Handle Technician Assignment
  const handleAssignTechnician = async () => {
    if (!selectedRequest) return;
    setIsUpdatingAction(true);
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedTechnicianId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRequest((prev: any) => ({
          ...prev,
          ...data.request,
          followUps: data.request?.followUps || prev?.followUps || [],
          attachments: data.request?.attachments || prev?.attachments || [],
        }));
        fetchRequests();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingAction(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedRequest) return;
    setIsUpdatingAction(true);
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          note: actionNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRequest((prev: any) => ({
          ...prev,
          ...data.request,
          followUps: data.request?.followUps || prev?.followUps || [],
          attachments: data.request?.attachments || prev?.attachments || [],
        }));
        setActionNote("");
        fetchRequests();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingAction(false);
    }
  };

  // Open Drawer and load fresh details
  const openRequestDrawer = async (r: any) => {
    setSelectedRequest(r);
    setSelectedTechnicianId(r.assignedStaffId || "");
    setStaffNoteText("");
    setStaffNotePhotos([]);

    try {
      const res = await fetch(`/api/requests/${r.id}?staffView=true`);
      const data = await res.json();
      if (data.success && data.request) {
        setSelectedRequest(data.request);
        setSelectedTechnicianId(data.request.assignedStaffId || "");
      }
    } catch (e) {
      console.error("Failed to load details for request:", e);
    }
  };

  // Fetch Archived Requests from Secondary DB
  const fetchArchivedRequests = async () => {
    setIsLoadingArchived(true);
    try {
      const res = await fetch("/api/admin/lifecycle");
      const data = await res.json();
      if (data.success) {
        setArchivedRequests(data.archivedRequests || []);
      }
    } catch (e) {
      console.error("Failed to fetch archived requests:", e);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  // Run Lifecycle Archival Sweep
  const handleRunSweep = async () => {
    setIsSweepingLifecycle(true);
    try {
      const res = await fetch("/api/admin/lifecycle", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSweepResult(data.result);
        fetchArchivedRequests();
        fetchRequests();
        alert(data.message);
      } else {
        alert(data.error || "Failed to run lifecycle sweep.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to run lifecycle sweep.");
    } finally {
      setIsSweepingLifecycle(false);
    }
  };

  // Photo select for staff note
  const handleStaffPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (staffNotePhotos.length + files.length > 3) {
      alert("Maximum 3 photo attachments allowed.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select image files only.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("File size exceeds 8MB limit.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setStaffNotePhotos((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            url: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemoveStaffPhoto = (index: number) => {
    setStaffNotePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Direct reply with annotated photo from lightbox modal
  const handleDirectReplyFromAdminPhoto = async (
    annotatedPhoto: { url: string; name: string },
    replyText?: string
  ) => {
    if (!selectedRequest) return;
    const res = await fetch(`/api/requests/${selectedRequest.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:
          (replyText && replyText.trim()) ||
          "Staff annotated photo attached pointing out issue.",
        attachments: [
          {
            name: annotatedPhoto.name,
            size: 60000,
            type: "image/png",
            url: annotatedPhoto.url,
          },
        ],
        isInternalStaffOnly: false,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const reqRes = await fetch(`/api/requests/${selectedRequest.id}?staffView=true`);
      const reqData = await reqRes.json();
      if (reqData.success && reqData.request) {
        setSelectedRequest(reqData.request);
      }
      fetchRequests();
    } else {
      throw new Error(data.error || "Failed to post note with photo");
    }
  };

  // Handle Post Staff Note / Update
  const handlePostStaffNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || (!staffNoteText.trim() && staffNotePhotos.length === 0)) return;

    setIsPostingStaffNote(true);
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: staffNoteText.trim(),
          attachments: staffNotePhotos,
          isInternalStaffOnly: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStaffNoteText("");
        setStaffNotePhotos([]);
        // Reload single request to get updated followUps and status
        const reqRes = await fetch(`/api/requests/${selectedRequest.id}?staffView=true`);
        const reqData = await reqRes.json();
        if (reqData.success && reqData.request) {
          setSelectedRequest(reqData.request);
        }
        fetchRequests();
      } else {
        alert(data.error || "Failed to post note");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingStaffNote(false);
    }
  };

  // Handle Admin Delete Request
  const handleDeleteAdminRequest = async () => {
    if (!selectedRequest) return;
    setIsDeletingAdminRequest(true);
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setShowAdminDeleteModal(false);
        setSelectedRequest(null);
        fetchRequests();
      } else {
        alert(data.error || "Failed to delete request.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete request.");
    } finally {
      setIsDeletingAdminRequest(false);
    }
  };

  // Handle Overall Admin Purge of Secondary / Archived DB Request
  const handlePurgeArchivedRequest = async () => {
    if (!selectedArchivedRequest) return;
    setIsPurgingArchived(true);
    try {
      const res = await fetch(`/api/requests/${selectedArchivedRequest.id || selectedArchivedRequest.ticketNumber}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setArchivedRequests((prev) =>
          prev.filter(
            (r) =>
              r.id !== selectedArchivedRequest.id &&
              r.ticketNumber !== selectedArchivedRequest.ticketNumber
          )
        );
        setSelectedArchivedRequest(null);
        setShowPurgeArchivedModal(false);
      } else {
        alert(data.error || "Failed to permanently purge record.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to purge archived request.");
    } finally {
      setIsPurgingArchived(false);
    }
  };

  // Track unread resident notes for small chat in admin drawer
  useEffect(() => {
    if (!selectedRequest?.followUps || selectedRequest.followUps.length === 0) {
      setAdminFirstUnreadId(null);
      return;
    }
    const storageKey = `last_read_admin_${selectedRequest.id}`;
    const rawLastRead = localStorage.getItem(storageKey);

    // Initial visit: initialize lastRead to current time so baseline existing history isn't marked as new
    if (rawLastRead === null) {
      localStorage.setItem(storageKey, String(Date.now()));
      setAdminFirstUnreadId(null);
      return;
    }

    const lastRead = Number(rawLastRead);

    // Filter unread notes from resident (msgTime > lastRead)
    const unreadMessages = selectedRequest.followUps.filter((msg: any) => {
      const msgTime = new Date(msg.createdAt).getTime();
      return msgTime > lastRead && msg.authorRole === "requester";
    });

    if (unreadMessages.length > 0) {
      // In descending list, the oldest unread message is at the bottom of the new messages group.
      // The divider "New Messages Above" appears right below this message!
      const oldestUnread = [...unreadMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      setAdminFirstUnreadId(oldestUnread.id);
    } else {
      setAdminFirstUnreadId(null);
    }

    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, String(Date.now()));
    }, 4000);

    return () => clearTimeout(timer);
  }, [selectedRequest?.id, selectedRequest?.followUps]);

  // Auto-scroll admin follow-up container to bottom on update
  useEffect(() => {
    if (adminFollowUpContainerRef.current) {
      adminFollowUpContainerRef.current.scrollTop = adminFollowUpContainerRef.current.scrollHeight;
    }
  }, [selectedRequest?.followUps]);

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserData),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddUserModal(false);
        setNewUserData({ name: "", email: "", phone: "", roleId: "", departmentId: "" });
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open Add User Modal with smart department locking
  const handleOpenAddUserModal = () => {
    const technicianRole = roles.find((r) => r.level === 3 || r.code === "DEPT_STAFF");
    setNewUserData({
      name: "",
      email: "",
      phone: "",
      roleId: isDeptAdmin && technicianRole ? technicianRole.id : (roles[0]?.id || ""),
      departmentId: isDeptAdmin ? (currentUser?.departmentId || "") : "",
    });
    setShowAddUserModal(true);
  };

  // Toggle User Active Status
  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, active: !currentActive }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || "Failed to update staff status");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "SUBMITTED" || r.status === "REOPENED").length;
    const inProgress = requests.filter((r) => r.status === "IN_PROGRESS" || r.status === "ASSIGNED").length;
    const resolved = requests.filter((r) => r.status === "RESOLVED" || r.status === "CLOSED").length;
    const urgent = requests.filter((r) => r.isUrgent || r.priority === "EMERGENCY" || r.escalationLevel > 0).length;
    const unassigned = requests.filter(
      (r) => !r.assignedStaffId && !r.assignedStaff && r.status !== "CLOSED" && r.status !== "RESOLVED"
    ).length;
    const myAssigned = requests.filter(
      (r) =>
        currentUser &&
        ((currentUser.id && r.assignedStaffId === currentUser.id) ||
          (currentUser.email && r.assignedStaff?.email?.toLowerCase() === currentUser.email?.toLowerCase())) &&
        r.status !== "CLOSED" &&
        r.status !== "RESOLVED"
    ).length;
    return { total, pending, inProgress, resolved, urgent, unassigned, myAssigned };
  }, [requests, currentUser]);

  const isLevel1Admin =
    currentUser?.roleLevel === 1 || currentUser?.roleCode === "OVERALL_ADMIN";
  const isDeptAdmin = currentUser?.roleLevel === 2 || currentUser?.roleCode === "DEPT_ADMIN";
  const isDeptStaff = currentUser?.roleLevel === 3 || currentUser?.roleCode === "DEPT_STAFF";
  const canManageDeptOrUniversal = isLevel1Admin || isDeptAdmin;
  const showAssignedToCol = canManageDeptOrUniversal || allowStaffViewUnassigned;

  // Multi-tier operational queue sorting with optional unassigned-only view
  const sortedRequests = useMemo(() => {
    let list = requests;
    if (unassignedOnlyFilter) {
      list = list.filter((r) => !r.assignedStaffId && !r.assignedStaff && r.status !== "CLOSED" && r.status !== "RESOLVED");
    }
    return sortComplaintsByOperationalPriority(list, currentUser);
  }, [requests, currentUser, unassignedOnlyFilter]);

  if (isSessionLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Verifying Staff Security Session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 sm:p-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Restricted Access • Authorized Staff Only</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Institute Works Department
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Please authenticate with your official staff credentials to access work orders, technician queues, and departmental controls.
            </p>
          </div>

          {loginError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Staff Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. admin@iitgn.ac.in or aee1.electrical@iitgn.ac.in"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Security Passcode
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter security passcode"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Authenticate & Open Console</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Staff Sign-In Selector for Authorized Review */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">
              Quick Sign-In by Role (Authorized Staff Accounts)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoProfiles.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleLogin(undefined, p.email)}
                  disabled={isLoggingIn}
                  className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 bg-slate-50/40 dark:bg-slate-800/40 transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {p.name.split(" ")[0]} {p.name.split(" ")[1]}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.roleLevel === 1
                          ? "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          : p.roleLevel === 2
                            ? "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        }`}>
                        Level {p.roleLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{p.roleName}</p>
                  </div>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-2 flex items-center">
                    Sign in as {p.roleLevel === 1 ? "Overall Admin" : p.departmentName.split(" ")[0]}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1536px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Top Role Switcher & Scope Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
                Institutional Works Control
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${currentUser?.roleCode === "DEPT_STAFF"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isLevel1Admin
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
              >
                {currentUser?.roleCode === "DEPT_STAFF"
                  ? "Level 3: Technician / Field Staff"
                  : isLevel1Admin
                    ? "Level 1: Overall Admin"
                    : `Level ${currentUser?.roleLevel || 2}: Department Admin`}
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight mt-1.5 sm:mt-2 text-white">
              {currentUser?.roleCode === "DEPT_STAFF"
                ? "Work Orders & Assigned Tasks"
                : "Operations & Maintenance Command"}
            </h1>

            <p className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {currentUser?.roleCode === "DEPT_STAFF"
                ? `Field Technician Console: Viewing tasks for ${currentUser?.departmentName || "your department"}. Tap Manage on any ticket for dedicated full-screen operations, status progression, and direct resident communication.`
                : isLevel1Admin
                  ? "Universal Access Active: You have visibility across all 7 departments, role permissions configuration, and institute-wide escalation management."
                  : `Department Scoped: Currently managing ${currentUser?.departmentName || "Assigned Department"
                  } work orders. Other departments are restricted according to institutional policy.`}
            </p>
          </div>

          {/* Role Switcher Demo Dropdown (Stacked Vertically) */}
          <div className="bg-white/10 rounded-2xl p-4 border border-white/10 w-full">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Switch Admin / Staff Profile (Live Demo)
              </label>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {demoProfiles.map((p) => {
                const isActive = currentUser?.email === p.email;
                return (
                  <button
                    key={p.email}
                    onClick={() => handleSwitchProfile(p.email)}
                    disabled={isSwitchingProfile}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white/10 text-slate-300 hover:bg-white/20"
                      }`}
                  >
                    <span>{p.name} ({p.roleName.replace(/Admin.*/, "")})</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total In Scope</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.total}</p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">All registered requests</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {isDeptAdmin ? "Needs Assignment" : "Action Needed"}
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {isDeptAdmin ? kpis.unassigned : kpis.pending}
          </p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {isDeptAdmin ? `${kpis.unassigned} unassigned tasks` : "Submitted & Reopened"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            {isDeptStaff ? "Assigned To You" : "In Progress"}
          </p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {isDeptStaff ? kpis.myAssigned : kpis.inProgress}
          </p>
          <span className="text-[10px] text-blue-600 dark:text-blue-400">
            {isDeptStaff ? `${kpis.myAssigned} work orders on your plate` : "Assigned / In field"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Resolved</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.resolved}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Completed & closed</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 shadow-xs col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Urgent / Escalated</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{kpis.urgent}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400">Emergency & Tier 1-3 Escalations</span>
        </div>
      </div>

      {/* Tabs Navigation - Responsive & Horizontally Scrollable on Mobile */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex space-x-4 sm:space-x-6 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none whitespace-nowrap shrink-0">
        <button
          onClick={() => setActiveTab("requests")}
          className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${activeTab === "requests"
            ? "border-indigo-600 text-indigo-600"
            : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Complaints Queue</span>
        </button>

        {isLevel1Admin && (
          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${activeTab === "roles"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Role & Permission Schema</span>
          </button>
        )}

        {canManageDeptOrUniversal && (
          <>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${activeTab === "users"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff & Personnel</span>
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${activeTab === "categories"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Complaint Zones & Categories</span>
            </button>
          </>
        )}

        {isLevel1Admin && (
          <button
            onClick={() => {
              setActiveTab("archived");
              fetchArchivedRequests();
            }}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${activeTab === "archived"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Archive className="w-4 h-4" />
            <span>Archived (Secondary DB)</span>
          </button>
        )}
      </div>

      {/* TAB 1: COMPLAINTS WORK QUEUE */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRequests()}
                placeholder="Search ticket, room, subject..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Department Dropdown (Only visible for Level 1 Overall Admin) */}
              {isLevel1Admin && (
                <div className="relative">
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REOPENED">Reopened</option>
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Priorities</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </select>

              {/* Unassigned Tasks Quick Filter (Admins) */}
              {canManageDeptOrUniversal && (
                <button
                  type="button"
                  onClick={() => setUnassignedOnlyFilter(!unassignedOnlyFilter)}
                  className={`text-xs px-3 py-2 rounded-xl border font-semibold transition-all cursor-pointer ${
                    unassignedOnlyFilter
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  title="Toggle queue to show only unassigned tickets"
                >
                  <span>{unassignedOnlyFilter ? "Showing: Unassigned Only" : "Filter: All Work Orders"}</span>
                </button>
              )}

              {/* Admin Policy Toggle: Allow Field Staff to View Unassigned Tasks */}
              {canManageDeptOrUniversal && (
                <button
                  type="button"
                  onClick={handleToggleStaffViewUnassigned}
                  className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                    allowStaffViewUnassigned
                      ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                  title="Controls whether technicians can see unassigned domain tasks or exclusively their own assigned tasks"
                >
                  {allowStaffViewUnassigned ? (
                    <ToggleRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Staff View Unassigned: <strong>{allowStaffViewUnassigned ? "ON" : "OFF"}</strong></span>
                </button>
              )}

              <button
                onClick={fetchRequests}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="Refresh Requests"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {isLoadingRequests ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading requests...</p>
              </div>
            ) : sortedRequests.length === 0 ? (
              <div className="py-20 text-center">
                <Wrench className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No maintenance requests found</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters or department search.</p>
              </div>
            ) : (
              <div>
                {/* Mobile Complaints Cards (<md screens: plumbers & field staff on small phones) */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedRequests.map((r) => {
                    const isAssignedToMe = Boolean(
                      currentUser &&
                      ((currentUser.id && r.assignedStaffId === currentUser.id) ||
                        (currentUser.email && r.assignedStaff?.email?.toLowerCase() === currentUser.email?.toLowerCase()))
                    );

                    return (
                      <div
                        key={r.id}
                        onClick={() => router.push(`/track/${r.ticketNumber}`)}
                        className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                {r.ticketNumber}
                              </span>
                              {r.reopenCount > 0 && (
                                <span className="inline-flex items-center text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                                  <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                                  {r.reopenCount}
                                </span>
                              )}
                            </div>
                            {isLevel1Admin && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                {r.department?.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {canManageDeptOrUniversal ? (
                              <select
                                value={r.priority}
                                onChange={(e) => handlePriorityChange(r.id, e.target.value)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  r.priority === "EMERGENCY"
                                    ? "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                    : r.priority === "HIGH"
                                      ? "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                }`}
                              >
                                <option value="NORMAL">NORMAL</option>
                                <option value="HIGH">HIGH</option>
                                <option value="EMERGENCY">EMERGENCY</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.priority === "EMERGENCY"
                                  ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                                  : r.priority === "HIGH"
                                    ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                  }`}
                              >
                                {r.priority}
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.status === "RESOLVED" || r.status === "CLOSED"
                                ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                                : r.status === "IN_PROGRESS"
                                  ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                                  : r.status === "REOPENED"
                                    ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                                    : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                }`}
                            >
                              {r.status}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {r.subject}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <span>📍 {r.locationDetail}</span>
                            <span>•</span>
                            <span>👤 {r.requesterName}</span>
                            {r.requesterPhone && (
                              <a
                                href={`tel:${r.requesterPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                              >
                                ({r.requesterPhone})
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Badges row & Touch Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 text-[11px]">
                            {r.followUps && r.followUps.length > 0 && (
                              <span className="inline-flex items-center text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/60 text-[10px]">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                {r.followUps.length}
                              </span>
                            )}
                            {((r.attachments && r.attachments.length > 0) || (r._count && r._count.attachments > 0)) && (
                              <span className="inline-flex items-center text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 text-[10px]">
                                <Camera className="w-3 h-3 mr-1" />
                                {r.attachments?.length || r._count?.attachments}
                              </span>
                            )}
                            {canManageDeptOrUniversal ? (
                              <select
                                value={r.assignedStaffId || r.assignedStaff?.id || ""}
                                onChange={(e) => handleQuickAssignTechnician(r.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={`text-[10px] font-medium px-2 py-0.5 rounded border max-w-[130px] truncate cursor-pointer ${
                                  r.assignedStaffId || r.assignedStaff
                                    ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold"
                                }`}
                              >
                                <option value="">-- Assign Tech --</option>
                                {deptStaffList
                                  .filter((s) => !r.departmentId || s.departmentId === r.departmentId)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </select>
                            ) : allowStaffViewUnassigned ? (
                              isAssignedToMe ? (
                                <span className="inline-flex items-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/60">
                                  ★ Assigned to You
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                                  -- Unassigned --
                                </span>
                              )
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/chat/${r.ticketNumber}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chat</span>
                            </Link>
                            <Link
                              href={`/track/${r.ticketNumber}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors shadow-2xs inline-flex items-center gap-1"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Manage</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Complaints Table (>=md screens) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">Ticket ID</th>
                        {isLevel1Admin && <th className="px-4 py-3.5">Department</th>}
                        <th className="px-4 py-3.5">Fault Details</th>
                        <th className="px-4 py-3.5">Location</th>
                        <th className="px-4 py-3.5">Requester</th>
                        <th className="px-4 py-3.5">Priority</th>
                        <th className="px-4 py-3.5">Status</th>
                        {showAssignedToCol && <th className="px-4 py-3.5">Assigned To</th>}
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {sortedRequests.map((r) => {
                        const isAssignedToMe = Boolean(
                          currentUser &&
                          ((currentUser.id && r.assignedStaffId === currentUser.id) ||
                            (currentUser.email && r.assignedStaff?.email?.toLowerCase() === currentUser.email?.toLowerCase()))
                        );

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                            onClick={() => openRequestDrawer(r)}
                          >
                            <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              <div className="flex flex-col">
                                <span>{r.ticketNumber}</span>
                                {r.reopenCount > 0 && (
                                  <span className="inline-flex items-center text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 w-fit mt-0.5">
                                    <RotateCcw className="w-2.5 h-2.5 mr-1" />
                                    Reopened ({r.reopenCount})
                                  </span>
                                )}
                              </div>
                            </td>
                            {isLevel1Admin && (
                              <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                                {r.department?.name}
                              </td>
                            )}
                            <td className="px-4 py-3.5 max-w-xs">
                              <p className="font-bold text-slate-900 dark:text-white truncate">{r.subject}</p>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                                <span>{r.domain} → {r.subDomain1}</span>
                                {((r.attachments && r.attachments.length > 0) || (r._count && r._count.attachments > 0)) && (
                                  <span className="inline-flex items-center text-blue-700 dark:text-blue-300 font-bold text-[10px] bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/60">
                                    <Camera className="w-3 h-3 mr-1" />
                                    {r.attachments?.length || r._count?.attachments} photo{(r.attachments?.length || r._count?.attachments) > 1 ? "s" : ""}
                                  </span>
                                )}
                                {r.followUps && r.followUps.length > 0 && (
                                  <span className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60">
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    {r.followUps.length} note{r.followUps.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{r.locationDetail}</td>
                            <td className="px-4 py-3.5">
                              <p className="text-slate-800 dark:text-slate-200 font-semibold">{r.requesterName}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.requesterPhone}</p>
                            </td>
                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              {canManageDeptOrUniversal ? (
                                <select
                                  value={r.priority}
                                  onChange={(e) => handlePriorityChange(r.id, e.target.value)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
                                    r.priority === "EMERGENCY"
                                      ? "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                      : r.priority === "HIGH"
                                        ? "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                  }`}
                                  title="Change Priority (Admins)"
                                >
                                  <option value="NORMAL">NORMAL</option>
                                  <option value="HIGH">HIGH</option>
                                  <option value="EMERGENCY">EMERGENCY</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.priority === "EMERGENCY"
                                    ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                                    : r.priority === "HIGH"
                                      ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                    }`}
                                >
                                  {r.priority}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${r.status === "RESOLVED" || r.status === "CLOSED"
                                    ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                                    : r.status === "IN_PROGRESS"
                                      ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                                      : r.status === "REOPENED"
                                        ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                                        : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                    }`}
                                >
                                  {r.status}
                                </span>
                                {r.status === "CLOSED" && r.closedAt && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    By {r.closedByRole === "requester" ? "Resident" : "Admin"}
                                  </span>
                                )}
                              </div>
                            </td>
                            {showAssignedToCol && (
                              <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                {canManageDeptOrUniversal ? (
                                  <select
                                    value={r.assignedStaffId || r.assignedStaff?.id || ""}
                                    onChange={(e) => handleQuickAssignTechnician(r.id, e.target.value)}
                                    className={`text-xs px-2.5 py-1 rounded-lg border max-w-[170px] truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium ${
                                      r.assignedStaffId || r.assignedStaff
                                        ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold"
                                    }`}
                                    title="Assign / Reassign Technician"
                                  >
                                    <option value="">-- Unassigned --</option>
                                    {deptStaffList
                                      .filter((s) => !r.departmentId || s.departmentId === r.departmentId)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                  </select>
                                ) : isAssignedToMe ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-900/60 shadow-2xs">
                                    ★ Assigned to You
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/60">
                                    -- Unassigned --
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/chat/${r.ticketNumber}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                                  title="Open Chat Screen"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </Link>
                                <Link
                                  href={`/track/${r.ticketNumber}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors shadow-2xs inline-flex items-center gap-1"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>Manage</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLE & PERMISSION SCHEMA MANAGER (Extensible Schema Feature) */}
      {activeTab === "roles" && isLevel1Admin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 text-slate-900 dark:text-white">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900/60">
              Modular Access Control Schema
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
              Role & Capability Configuration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Dynamically assign capabilities and permissions to roles. Changes take effect instantly across the application without requiring code modifications.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {roles.map((r) => {
              const isSelected = selectedRoleForEdit?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectRole(r)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${isSelected
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-xs"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      Level {r.level}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {r.userCount} assigned users
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mt-2">{r.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.description}</p>
                </div>
              );
            })}
          </div>

          {/* Edit Permissions Matrix for Selected Role */}
          {selectedRoleForEdit && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Permissions for: {selectedRoleForEdit.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Check or uncheck capabilities to configure the access boundary for this tier.
                  </p>
                </div>

                <button
                  onClick={handleSaveRolePermissions}
                  disabled={isSavingRole}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center cursor-pointer"
                >
                  {isSavingRole ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                  )}
                  <span>Save Role Permissions</span>
                </button>
              </div>

              {roleSaveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
                  <span>{roleSaveSuccess}</span>
                </div>
              )}

              {/* Permissions Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPermissions.map((perm) => {
                  const isChecked = editedRolePermissions.includes(perm.code);
                  return (
                    <label
                      key={perm.code}
                      className={`p-3.5 rounded-xl border text-xs flex items-start space-x-3 cursor-pointer transition-all ${isChecked
                        ? "bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-500 shadow-2xs text-slate-900 dark:text-white"
                        : "bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(perm.code)}
                        className="mt-0.5 rounded text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{perm.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{perm.code}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS & STAFF DIRECTORY (Overall Admin & Department Heads) */}
      {activeTab === "users" && canManageDeptOrUniversal && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 text-slate-900 dark:text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {isDeptAdmin
                    ? `${currentUser?.departmentName || "Department"} Staff & Technicians`
                    : "Institute Personnel & Staff Directory"}
                </h2>
                {isDeptAdmin && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                    Dept Head Scoped
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isDeptAdmin
                  ? `Manage field technicians and operational staff assigned to ${currentUser?.departmentName}.`
                  : "Manage user accounts, departmental assignments, and role capabilities."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isDeptAdmin && (
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setUserDeptFilter("ALL")}
                    className={`px-3 py-1 rounded-lg transition-all ${userDeptFilter === "ALL"
                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                  >
                    My Dept Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserDeptFilter("CAMPUS_ALL")}
                    className={`px-3 py-1 rounded-lg transition-all ${userDeptFilter === "CAMPUS_ALL"
                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                  >
                    All Campus Staff
                  </button>
                </div>
              )}

              <button
                onClick={handleOpenAddUserModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allUsers
              .filter((u) => {
                if (isDeptAdmin && userDeptFilter !== "CAMPUS_ALL") {
                  return u.departmentId === currentUser?.departmentId;
                }
                return true;
              })
              .map((u) => {
                const canModifyThisUser = isLevel1Admin || (isDeptAdmin && u.departmentId === currentUser?.departmentId);

                return (
                  <div
                    key={u.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                        {u.role?.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {u._count?.assignedRequests || 0} jobs
                        </span>
                        {canModifyThisUser && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(u.id, u.active)}
                            title={u.active ? "Suspend Staff Access" : "Activate Staff Access"}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${u.active
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100"
                                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100"
                              }`}
                          >
                            {u.active ? "● Active" : "○ Suspended"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        {u.department?.name || "Universal (All Departments)"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
                        <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {u.email}
                      </p>
                      {u.phone && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center">
                          <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {u.phone}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}



      {/* TAB 5: COMPLAINT ZONES & CATEGORIES (Overall Admin & Department Heads) */}
      {activeTab === "categories" && canManageDeptOrUniversal && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-900/60">
                  Public Portal Customization
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/60">
                  {categoriesList.filter((c) => c.active !== false).length} Active Zones
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
                Complaint Zones & Residential Portals
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Add, customize, or deactivate public complaint portals (such as Faculty Housing, Student Hostels, Academic Labs, or Sports Complex). Changes appear immediately across the home page and generate active complaint URLs.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreateCategory}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Zone</span>
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {categoryActionSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{categoryActionSuccess}</span>
            </div>
          )}

          {categoryActionError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center space-x-2 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{categoryActionError}</span>
            </div>
          )}

          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Search complaint zones by name, slug, or trade..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Showing {categoriesList.length} total zones
            </span>
          </div>

          {/* Categories Grid */}
          {isLoadingCategories ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading complaint zones from database...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categoriesList
                .filter((cat) => {
                  if (!categorySearchQuery.trim()) return true;
                  const q = categorySearchQuery.toLowerCase();
                  return (
                    cat.name.toLowerCase().includes(q) ||
                    cat.slug.toLowerCase().includes(q) ||
                    cat.shortDescription?.toLowerCase().includes(q) ||
                    cat.allowedDomains?.some((d: string) => d.toLowerCase().includes(q))
                  );
                })
                .map((cat) => {
                  const IconComp = getCategoryIconComponent(cat.icon);
                  const isCatActive = cat.active !== false;

                  return (
                    <div
                      key={cat.id || cat.slug}
                      className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-5 shadow-xs ${isCatActive
                          ? "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-75"
                        }`}
                    >
                      <div className="space-y-4">
                        {/* Top Badge & Status Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${isCatActive
                                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700"
                                }`}
                            >
                              <IconComp className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                                {cat.name}
                              </h3>
                              <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 block">
                                /new/{cat.slug}
                              </span>
                            </div>
                          </div>

                          {/* Quick Active Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryActive(cat)}
                            title={isCatActive ? "Deactivate Zone" : "Activate Zone"}
                            className={`p-1 rounded-full text-xs font-bold transition-colors ${isCatActive
                                ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                              }`}
                          >
                            {isCatActive ? (
                              <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 font-semibold">
                                Live
                              </span>
                            ) : (
                              <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-300 dark:border-slate-700">
                                Paused
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {cat.shortDescription || "No description provided."}
                        </p>

                        {/* Location Type Badge */}
                        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-medium">Location Style:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                            {cat.locationType === "apartment"
                              ? "Residential Flat (01/101)"
                              : cat.locationType === "hostel"
                                ? "Hostel Block + Room"
                                : cat.locationType === "academic"
                                  ? "Academic Lab / Office"
                                  : "General Campus Area"}
                          </span>
                        </div>

                        {/* Allowed Services Pills */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                            Services Handled:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {cat.allowedDomains?.map((d: string) => (
                              <span
                                key={d}
                                className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/new/${cat.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            <span>Live Form</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-1 text-slate-400" />
                          </Link>

                          <Link
                            href={`/new/${cat.slug}?mode=editor`}
                            className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-900/60 transition-colors shadow-2xs"
                            title="Open live visual form builder to customize buildings, locations, instructions, domains & faults"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />
                            <span>Visual Editor</span>
                          </Link>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCategory(cat)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                            title="Edit Category Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ARCHIVED REQUESTS (SECONDARY DB / COLD STORAGE) */}
      {activeTab === "archived" && isLevel1Admin && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="inline-flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Archive className="w-4 h-4" />
                  <span>Secondary Archival Database • Automated Cold Storage</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Archived Maintenance Records
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                  Complaints that remain closed past the reopen grace window are moved from active operational tables into this secondary archival database. Records are preserved here for 180 days before permanent automated deletion.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRunSweep}
                  disabled={isSweepingLifecycle}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2"
                >
                  {isSweepingLifecycle ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Run Archival & Purge Sweep</span>
                </button>
              </div>
            </div>

            {/* Lifecycle Constants & Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 font-medium block">Total Archived in Secondary DB</span>
                <span className="text-2xl font-black text-indigo-400 mt-1 block">
                  {archivedRequests.length}
                </span>
                <span className="text-[10px] text-slate-400">Cold storage snapshots</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 font-medium block">Admin Closure Grace Window</span>
                <span className="text-2xl font-black text-amber-400 mt-1 block">
                  3 Days
                </span>
                <span className="text-[10px] text-slate-400">Resident can reopen via reply</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 font-medium block">Requester Closure Grace Window</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">
                  15 Mins
                </span>
                <span className="text-[10px] text-slate-400">Immediate archival afterwards</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-slate-400 font-medium block">Permanent Purge Horizon</span>
                <span className="text-2xl font-black text-rose-400 mt-1 block">
                  180 Days
                </span>
                <span className="text-[10px] text-slate-400">Irreversible automated wipe</span>
              </div>
            </div>

            {sweepResult && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Last sweep executed at {new Date(sweepResult.processedAt).toLocaleTimeString()}: {sweepResult.archivedAdminClosedCount} admin-closed tickets archived, {sweepResult.archivedUserClosedCount} resident-closed tickets archived, {sweepResult.purgedCount} expired records purged.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Archived Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Archive className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Transferred Complaint Snapshots</h3>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Showing {archivedRequests.length} record{archivedRequests.length === 1 ? "" : "s"}
              </span>
            </div>

            {isLoadingArchived ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium">Loading secondary storage records...</span>
              </div>
            ) : archivedRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                No tickets currently archived in secondary database. All closed complaints are either within grace period or none have expired.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Ticket ID</th>
                      <th className="px-4 py-3.5">Department</th>
                      <th className="px-4 py-3.5">Subject & Category</th>
                      <th className="px-4 py-3.5">Requester & Location</th>
                      <th className="px-4 py-3.5">Closed Info</th>
                      <th className="px-4 py-3.5">Purge Schedule</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {archivedRequests.map((arch) => {
                      const purgeDate = new Date(arch.purgeDueAt);
                      const daysRemaining = Math.max(0, Math.ceil((purgeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                      return (
                        <tr key={arch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {arch.ticketNumber}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                            {arch.departmentName || "General Works"}
                          </td>
                          <td className="px-4 py-3.5 max-w-xs">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{arch.subject}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                              {arch.category} • {arch.domain}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-slate-800 dark:text-slate-200 font-semibold">{arch.requesterName}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{arch.locationDetail}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-slate-700 dark:text-slate-300 font-semibold block">
                              {new Date(arch.closedAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              By {arch.closedByRole === "requester" ? "Resident" : "Admin"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              Purges in {daysRemaining} days
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                              {purgeDate.toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedArchivedRequest(arch)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 hover:text-white text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                            >
                              Inspect Snapshot
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ARCHIVED SNAPSHOT INSPECTOR MODAL */}
      {selectedArchivedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto space-y-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedArchivedRequest.ticketNumber} • Secondary DB Snapshot
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedArchivedRequest.subject}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedArchivedRequest.departmentName} • {selectedArchivedRequest.locationDetail}
                </p>
              </div>

              <button
                onClick={() => setSelectedArchivedRequest(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Lifecycle Notice */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-2 border border-slate-800">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <Archive className="w-4 h-4" />
                <span>Frozen Archival Snapshot (Cold Storage)</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Archived on {new Date(selectedArchivedRequest.archivedAt).toLocaleString()}. Retained for 180 days until permanent deletion on {new Date(selectedArchivedRequest.purgeDueAt).toLocaleDateString()}.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Original Description
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedArchivedRequest.description}
              </p>
            </div>

            {/* Requester Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Resident Name:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedArchivedRequest.requesterName}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Contact:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedArchivedRequest.requesterPhone}</span>
              </div>
            </div>

            {/* Follow-ups Thread Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Follow-up Notes at Time of Archival
              </h4>
              {(() => {
                let notes: any[] = [];
                try {
                  notes = JSON.parse(selectedArchivedRequest.followUpsJson || "[]");
                } catch {
                  notes = [];
                }

                if (notes.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 dark:text-slate-500 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      No follow-up notes were posted on this complaint.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {notes.map((n: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-800 dark:text-slate-200">{n.authorName} ({n.authorRole})</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              {isLevel1Admin ? (
                <button
                  type="button"
                  onClick={() => setShowPurgeArchivedModal(true)}
                  className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Overall Administrator Permanent Purge"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Record Forever (Admin Only)</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedArchivedRequest(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERALL ADMIN PURGE ARCHIVED RECORD CONFIRMATION MODAL */}
      {showPurgeArchivedModal && selectedArchivedRequest && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-5 animate-in fade-in zoom-in-95 text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                Overall Administrator Authority
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Purge Archived Record Forever?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As Overall Administrator, this is your final call: archived ticket <strong className="font-mono text-indigo-600 dark:text-indigo-400">{selectedArchivedRequest.ticketNumber}</strong> will be <strong>deleted forever from the secondary database</strong>. This historical record cannot be recovered.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isPurgingArchived}
                onClick={() => setShowPurgeArchivedModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPurgingArchived}
                onClick={handlePurgeArchivedRequest}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-60"
              >
                {isPurgingArchived ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span>Purge Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTED REQUEST MANAGE DRAWER / MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedRequest.ticketNumber}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedRequest.subject}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedRequest.department?.name} • {selectedRequest.locationDetail} • Reported by <strong>{selectedRequest.requesterName}</strong> ({selectedRequest.requesterPhone})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/chat/${selectedRequest.ticketNumber}`}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  title="Open Full Chat Screen"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open Full Chat</span>
                  <span className="sm:hidden">Chat</span>
                </Link>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Closed Ticket Grace Alert Banner */}
            {selectedRequest.status === "CLOSED" && (
              <div
                className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${selectedRequest.canReopen !== false
                    ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
              >
                <div className="flex items-start space-x-2.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Closed by {selectedRequest.closedByRole === "requester" ? "Resident" : "Admin"} • {selectedRequest.closedByRole === "requester" ? "15-Minute" : "3-Day"} Reopen Grace Window Active
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      If the resident replies in Follow-up Notes or clicks reopen, ticket automatically flips back to <strong>IN PROGRESS</strong>. Once grace window concludes without activity, it transfers to Secondary Archival DB.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus("IN_PROGRESS")}
                  disabled={isUpdatingAction}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen (In Progress)</span>
                </button>
              </div>
            )}

            {/* Quick Status Bar */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Current Status:</span>
                <span
                  className={`font-bold text-xs px-2.5 py-0.5 rounded-full ${selectedRequest.status === "RESOLVED" || selectedRequest.status === "CLOSED"
                      ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                      : selectedRequest.status === "IN_PROGRESS"
                        ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                        : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                    }`}
                >
                  {selectedRequest.status}
                </span>

                {/* Priority Selector for Admins / Badge for Staff */}
                {canManageDeptOrUniversal ? (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Priority:</span>
                    <select
                      value={selectedRequest.priority}
                      onChange={(e) => handlePriorityChange(selectedRequest.id, e.target.value)}
                      className={`text-xs font-bold px-2 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        selectedRequest.priority === "EMERGENCY"
                          ? "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                          : selectedRequest.priority === "HIGH"
                            ? "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="EMERGENCY">EMERGENCY</option>
                    </select>
                  </div>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ml-1 ${
                      selectedRequest.priority === "EMERGENCY"
                        ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                        : selectedRequest.priority === "HIGH"
                          ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Priority: {selectedRequest.priority}
                  </span>
                )}

                {selectedRequest.reopenCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                    Reopened {selectedRequest.reopenCount}x
                  </span>
                )}
                {selectedRequest.escalationLevel > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                    Tier {selectedRequest.escalationLevel} Escalated
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 items-center">
                {selectedRequest.status !== "ACKNOWLEDGED" && (
                  <button
                    onClick={() => handleUpdateStatus("ACKNOWLEDGED")}
                    disabled={isUpdatingAction}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
                {selectedRequest.status !== "IN_PROGRESS" && (
                  <button
                    onClick={() => handleUpdateStatus("IN_PROGRESS")}
                    disabled={isUpdatingAction}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Start Work
                  </button>
                )}
                {selectedRequest.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleUpdateStatus("RESOLVED")}
                    disabled={isUpdatingAction}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Mark Resolved
                  </button>
                )}

                {/* Escalate Matter Button for Staff and Admins */}
                {selectedRequest.status !== "CLOSED" && (
                  <button
                    type="button"
                    onClick={() => handleStaffEscalate(selectedRequest.id)}
                    disabled={isUpdatingAction || selectedRequest.escalationLevel >= 3}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title={selectedRequest.escalationLevel >= 3 ? "Maximum escalation tier reached" : "Escalate to Senior Engineer / Directorate"}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Escalate {selectedRequest.escalationLevel > 0 ? `(Tier ${selectedRequest.escalationLevel + 1})` : "Matter"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Follow-up Notes & Updates Thread (Prominently Placed at the Top of Drawer) */}
            <div className="space-y-3 p-3.5 sm:p-4 rounded-xl bg-indigo-50/40 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-slate-700 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Follow-up Notes & Updates ({selectedRequest.followUps?.length || 0})
                      </h4>
                      {adminFirstUnreadId && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                          New resident message
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">Direct notes and communication with resident</p>
                  </div>
                </div>
                <Link
                  href={`/chat/${selectedRequest.ticketNumber}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>View Chat in Large</span>
                </Link>
              </div>

              {/* Messages Thread List: Chronological (Oldest top, Newest bottom) */}
              <div
                ref={adminFollowUpContainerRef}
                className="space-y-3 max-h-[320px] overflow-y-auto px-1 py-1 scrollbar-thin"
              >
                {(!selectedRequest.followUps || selectedRequest.followUps.length === 0) ? (
                  <div className="p-5 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    No follow-up messages or notes recorded yet for this complaint.
                  </div>
                ) : (
                  [...(selectedRequest.followUps || [])]
                    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((msg: any) => {
                      const isResident = msg.authorRole === "requester";
                      const isMe = !isResident;
                      const parsed = parseCommentContent(msg.message);

                      return (
                        <div key={msg.id} className="space-y-2">
                          {/* Unread Messages Separator (New Messages Below) */}
                          {adminFirstUnreadId === msg.id && (
                            <div className="relative my-2.5 flex items-center justify-center">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-indigo-300 dark:border-indigo-600" />
                              </div>
                              <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-xs uppercase tracking-wider animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>New Messages Below</span>
                              </div>
                            </div>
                          )}

                          {/* Chat-style Bubble: Outgoing (Staff/Me) on Right in Indigo, Incoming (Resident) on Left in Slate */}
                          <div className={`flex ${isMe ? "justify-end" : "justify-start"} transition-all`}>
                            <div
                              className={`relative p-3 rounded-2xl shadow-2xs max-w-[88%] sm:max-w-[76%] space-y-1.5 text-xs ${
                                isMe
                                  ? "bg-indigo-600 text-white rounded-tr-xs border border-indigo-500"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700"
                              }`}
                            >
                              {/* Sender Header for Resident Only (no 'You' or staff header for own messages) */}
                              {!isMe && (
                                <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    {msg.authorName}
                                  </span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                                    Resident Requester
                                  </span>
                                </div>
                              )}

                              {/* Message Text */}
                              {parsed.text && (
                                <p
                                  className={`leading-relaxed whitespace-pre-wrap break-words font-medium ${
                                    isMe ? "text-white" : "text-slate-800 dark:text-slate-200"
                                  }`}
                                >
                                  {parsed.text}
                                </p>
                              )}

                              {/* Attached Photos in Comment */}
                              {parsed.images.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {parsed.images.map((img: any, i: number) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => openAdminLightbox(parsed.images, i)}
                                      className="group relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 aspect-square w-16 h-16 sm:w-20 sm:h-20 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                                        <Eye className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Timestamp at bottom like chat applications */}
                              <div
                                className={`flex items-center justify-end text-[10px] gap-1 pt-0.5 ${
                                  isMe ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {isMe && <CheckCheck className="w-3.5 h-3.5 text-indigo-200 inline" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Note Composition Box */}
              <form onSubmit={handlePostStaffNote} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">
                    Post Note or Update:
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Visible to resident on tracking page
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={staffNoteText}
                  onChange={(e) => setStaffNoteText(e.target.value)}
                  placeholder="Type update (e.g. Visited room, replaced capacitor, parts ordered)..."
                  className="w-full text-xs p-3 rounded-2xl border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />

                {/* Staff photo previews */}
                {staffNotePhotos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {staffNotePhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 w-16 h-16 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-2xs"
                      >
                        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveStaffPhoto(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs z-10"
                          title="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnotatingStaffPhotoIdx(idx)}
                          className="absolute bottom-0 inset-x-0 py-0.5 bg-slate-900/90 hover:bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs z-10 transition-colors"
                          title="Edit or draw markings on this photo"
                        >
                          <Pen className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ))}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {staffNotePhotos.length}/3 photos
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 font-semibold text-xs cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Attach Photo ({staffNotePhotos.length}/3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleStaffPhotoSelect}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isPostingStaffNote || (!staffNoteText.trim() && staffNotePhotos.length === 0)}
                    className="px-4 py-2 font-bold text-xs rounded-xl flex items-center transition-colors text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-500/20"
                  >
                    {isPostingStaffNote ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <>
                        <span>Send Update</span>
                        <Send className="w-3.5 h-3.5 ml-1.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Technician Assignment (Admins Only - Staff cannot assign work) */}
            {canManageDeptOrUniversal ? (
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Assign / Reassign Technician
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedTechnicianId || selectedRequest.assignedStaffId || ""}
                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose Field Technician --</option>
                    {deptStaffList
                      .filter((s) => !selectedRequest.departmentId || s.departmentId === selectedRequest.departmentId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.department?.name})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleAssignTechnician}
                    disabled={isUpdatingAction}
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl shrink-0 cursor-pointer border border-slate-700"
                  >
                    Assign
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-600 dark:text-slate-400 block text-[11px]">Assignment Status:</span>
                  <span className="font-semibold text-slate-900 dark:text-white mt-0.5 inline-block">
                    {selectedRequest.assignedStaffId === currentUser?.id ? "Assigned to You" : "Unassigned (Open Department Pool)"}
                  </span>
                </div>
                {selectedRequest.assignedStaffId === currentUser?.id ? (
                  <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200 dark:border-indigo-900/60 shadow-2xs">
                    ★ Assigned to You
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-200 dark:border-amber-900/60">
                    -- Unassigned --
                  </span>
                )}
              </div>
            )}

            {/* Fault Description & Location Details */}
            <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Reported Fault Description
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/60">
                  {selectedRequest.domain} → {selectedRequest.subDomain1}{selectedRequest.subDomain2 ? ` → ${selectedRequest.subDomain2}` : ""}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-wrap font-medium">
                {selectedRequest.description || selectedRequest.subject}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block font-semibold text-[10px]">Location:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRequest.locationDetail} {selectedRequest.corridor ? `(${selectedRequest.corridor})` : ""}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block font-semibold text-[10px]">Resident Availability:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRequest.availability || "Standard Working Hours"}</span>
                </div>
              </div>
            </div>

            {/* Attached Fault Photos Gallery (2 rows max, 3rd row overflow blurred with +X) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Attached Fault Photos ({selectedRequest.attachments?.length || 0})
                </h4>
              </div>

              {(!selectedRequest.attachments || selectedRequest.attachments.length === 0) ? (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No fault photos attached by resident at time of filing.
                </div>
              ) : (
                <EvidencePhotosGallery
                  attachments={selectedRequest.attachments}
                  title="Evidence Photos"
                  aspectRatioClass="aspect-4/3"
                  onSelectImage={(idx) =>
                    openAdminLightbox(
                      selectedRequest.attachments.map((att: any) => ({
                        url: att.url,
                        name: att.originalName || "Fault Photo",
                        sizeBytes: att.sizeBytes,
                      })),
                      idx
                    )
                  }
                />
              )}
            </div>

            {/* Bottom Actions: Delete Request (Overall Admin Only) & Public Tracker Link */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              {isLevel1Admin ? (
                <button
                  type="button"
                  onClick={() => setShowAdminDeleteModal(true)}
                  className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                  title="Overall Administrator Permanent Deletion"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Delete Complaint (Admin Only)</span>
                </button>
              ) : (
                <div />
              )}

              <Link
                href={`/track/${selectedRequest.ticketNumber}?token=${selectedRequest.trackingToken}`}
                target="_blank"
                className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
              >
                <span>Open Public Tracker</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* OVERALL ADMIN ACTIVE COMPLAINT HARD DELETE CONFIRMATION MODAL */}
      {showAdminDeleteModal && selectedRequest && (
        <div className="fixed inset-0 z-[99998] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-5 animate-in fade-in zoom-in-95 text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                Overall Administrator Authority
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Permanently Delete Complaint?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As Overall Administrator, this is your final call: complaint <strong className="font-mono text-indigo-600 dark:text-indigo-400">{selectedRequest.ticketNumber}</strong> will be <strong>deleted forever from the database</strong>, cascading through all status history, comments, and attachments. This action is irreversible.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingAdminRequest}
                onClick={() => setShowAdminDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAdminRequest}
                onClick={handleDeleteAdminRequest}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-60"
              >
                {isDeletingAdminRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    <span>Deleting Forever...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span>Delete Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LIGHTBOX MODAL WITH ZOOM, PAN, ANNOTATION, DIRECT REPLY & BACK-BUTTON SUPPORT */}
      {adminLightboxGallery && (
        <ImageLightboxModal
          images={adminLightboxGallery.images}
          initialIndex={adminLightboxGallery.initialIndex}
          onClose={() => setAdminLightboxGallery(null)}
          onDirectReply={handleDirectReplyFromAdminPhoto}
        />
      )}

      {/* Modal for annotating staff uploaded photos before posting */}
      {annotatingStaffPhotoIdx !== null && staffNotePhotos[annotatingStaffPhotoIdx] && (
        <ImageLightboxModal
          images={[
            {
              url: staffNotePhotos[annotatingStaffPhotoIdx].url,
              name: staffNotePhotos[annotatingStaffPhotoIdx].name || "Staff Photo",
            },
          ]}
          startInDrawMode={true}
          onClose={() => setAnnotatingStaffPhotoIdx(null)}
          onSaveAnnotation={(annotatedUrl) => {
            setStaffNotePhotos((prev) =>
              prev.map((item, i) =>
                i === annotatingStaffPhotoIdx ? { ...item, url: annotatedUrl } : item
              )
            );
            setAnnotatingStaffPhotoIdx(null);
          }}
        />
      )}

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-slate-900 dark:text-white"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add New Staff / Admin</h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Phone</label>
              <input
                type="tel"
                value={newUserData.phone}
                onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role Level</label>
              <select
                required
                value={newUserData.roleId}
                onChange={(e) => setNewUserData({ ...newUserData, roleId: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">-- Choose Role --</option>
                {roles
                  .filter((r) => !isDeptAdmin || r.level === 3 || r.code === "DEPT_STAFF")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Level {r.level})
                    </option>
                  ))}
              </select>
              {isDeptAdmin && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                  Department Heads can add technicians and operational staff to their department.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department Assignment
              </label>
              {isDeptAdmin ? (
                <div className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-between">
                  <span>{currentUser?.departmentName || "Assigned Department"}</span>
                  <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/60 font-semibold">
                    Locked to Your Department
                  </span>
                </div>
              ) : (
                <select
                  value={newUserData.departmentId}
                  onChange={(e) => setNewUserData({ ...newUserData, departmentId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">-- Universal (All Departments) --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {isCreatingUser ? "Creating..." : "Save User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {editingCategory ? "Update Complaint Zone" : "New Complaint Zone"}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {editingCategory ? `Edit "${editingCategory.name}"` : "Create New Complaint Zone"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure this location so residents can report issues directly to the appropriate trades.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryActionError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{categoryActionError}</span>
              </div>
            )}

            {/* Quick shortcut to open Visual Form Editor */}
            <div className="p-4 rounded-2xl bg-linear-to-r from-indigo-50 via-purple-50 to-indigo-50 dark:from-slate-800/80 dark:via-indigo-950/30 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Want to customize specific buildings, hostels, or fault categories?
                  </h4>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    Open the in-place Visual Form Editor to add new academic complexes, hostels, guidance notes, or trade fault options directly on the live form.
                  </p>
                </div>
              </div>
              <Link
                href={`/new/${editingCategory?.slug || categoryForm.slug || "academic"}?mode=editor`}
                target="_blank"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 inline-flex items-center space-x-1.5 shadow-sm shadow-indigo-500/20"
              >
                <span>Open Live Form Editor</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-6">
              {/* Field 1: Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Zone Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setCategoryForm((prev) => ({
                        ...prev,
                        name: newName,
                        // Auto-suggest slug when creating
                        slug:
                          !editingCategory && !prev.slug
                            ? newName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                            : prev.slug,
                      }));
                    }}
                    placeholder="e.g. Sports Complex & Gymnasium"
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Shown on home page card and form title.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Web Link Slug <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">
                      /new/
                    </span>
                    <input
                      type="text"
                      required
                      value={categoryForm.slug}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                        }))
                      }
                      placeholder="e.g. sports_complex"
                      className="w-full text-xs font-mono pl-14 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
                    🔗 Direct URL: http://localhost:3000/new/{categoryForm.slug || "zone_slug"}
                  </span>
                </div>
              </div>

              {/* Field 2: Short Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Short Description for Residents
                </label>
                <textarea
                  rows={2}
                  value={categoryForm.shortDescription}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, shortDescription: e.target.value }))
                  }
                  placeholder="e.g. Gymnasium, swimming pool, badminton courts, and sports pavilion."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Field 3: Visual Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Choose a Display Icon
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                  {CATEGORY_ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = categoryForm.icon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCategoryForm((prev) => ({ ...prev, icon: opt.id }))}
                        className={`p-2 rounded-xl text-center flex flex-col items-center justify-center space-y-1 transition-all ${isSelected
                            ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700"
                          }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] truncate max-w-full leading-tight">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 4: Location Style Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  What Location Info Should Residents Enter?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LOCATION_TYPE_OPTIONS.map((loc) => {
                    const LocIcon = loc.icon;
                    const isSelected = categoryForm.locationType === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() =>
                          setCategoryForm((prev) => ({
                            ...prev,
                            locationType: loc.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl border text-left flex items-start space-x-3 transition-all ${isSelected
                            ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                        >
                          <LocIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{loc.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {loc.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 5: Corridor / Wing Option */}
              <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="hasCorridor"
                  checked={categoryForm.hasCorridor}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, hasCorridor: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="hasCorridor" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <strong>Include Corridor / Wing field</strong> (Recommended for housing blocks and large facilities)
                </label>
              </div>

              {/* Field 6: Allowed Maintenance Services */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Available Maintenance Services <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                  Residents will only be able to select from the trades checked below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_AVAILABLE_DOMAINS.map((domain) => {
                    const isChecked = categoryForm.allowedDomains.includes(domain.id);
                    return (
                      <label
                        key={domain.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2.5 cursor-pointer transition-colors ${isChecked
                            ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 text-slate-900 dark:text-white"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCategoryForm((prev) => ({
                              ...prev,
                              allowedDomains: checked
                                ? [...prev.allowedDomains, domain.id]
                                : prev.allowedDomains.filter((d) => d !== domain.id),
                            }));
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <strong className="block text-xs font-bold">{domain.label}</strong>
                          <span className="text-[10px] text-slate-400 block">{domain.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Field 7: Active status */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Portal Active Status
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    When active, this zone appears on the home page and allows complaint filing.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCategoryForm((prev) => ({ ...prev, active: !prev.active }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${categoryForm.active
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  {categoryForm.active ? "Active" : "Inactive"}
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSavingCategory ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Complaint Zone</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/50">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Complaint Zone?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to remove <strong>&ldquo;{deleteConfirmCategory.name}&rdquo;</strong>?
                If residents have already filed complaints under this zone, it will be safely disabled/deactivated to preserve past ticket records.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmCategory(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={isDeletingCategory}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isDeletingCategory ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Yes, Delete Zone</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
