"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CATEGORIES,
  DOMAIN_CASCADE,
  HOSTEL_LIST,
  JEET_BLOCKS,
  ACADEMIC_BLOCKS,
  HOUSING_APARTMENTS,
} from "@/config/categories";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  Copy,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  Plus,
  Save,
  RotateCcw,
  Eye,
  Settings2,
  Building2,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
  Camera,
  ArrowUpRight,
  Pen,
  Phone,
} from "lucide-react";
import { saveTicketToStorage } from "@/lib/storage/ticketStorage";
import ImageLightboxModal from "@/components/ImageLightboxModal";

const ALL_POSSIBLE_DOMAINS = [
  "Electrical",
  "Civil",
  "Plumbing",
  "Air-Conditioning",
  "Water-Cooler",
  "Carpentry",
  "Network/IT",
];

export default function NewComplaintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const categorySlug = (params?.category as string) || "housing";
  const initialMode = searchParams?.get("mode") === "editor";

  const initialCategory = CATEGORIES[categorySlug] || {
    slug: categorySlug,
    name: categorySlug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortDescription: "Campus Maintenance Zone",
    icon: "Building2",
    locationType: "general",
    hasCorridor: false,
    allowedDomains: ["Electrical", "Civil", "Plumbing", "Air-Conditioning"],
    locationOptions: [],
    responseTimeText: "Avg Response: < 24 hrs",
    bannerNotice: null,
    instructions: null,
    urgencyPrompt: null,
    customCascades: {},
  };

  const [category, setCategory] = useState<any>(initialCategory);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Editor Mode State
  const [isEditorActive, setIsEditorActive] = useState(initialMode);
  const [editedCategory, setEditedCategory] = useState<any>(initialCategory);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Sub-items editor inputs
  const [newLocationInput, setNewLocationInput] = useState("");
  const [showLocationsManager, setShowLocationsManager] = useState(true);
  const [showCascadeManager, setShowCascadeManager] = useState(false);
  const [selectedCascadeDomain, setSelectedCascadeDomain] = useState("Electrical");
  const [newSub1Input, setNewSub1Input] = useState("");
  const [newSub2Input, setNewSub2Input] = useState("");

  // Public Form State
  const [formData, setFormData] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    sharePhoneWithStaff: true,
    locationCategory: initialCategory.name,
    locationPrimary: "",
    locationRoom: "",
    corridor: "",
    preferredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    preferredStartTime: "10:00",
    preferredEndTime: "12:00",
    domain: initialCategory.allowedDomains[0] || "Electrical",
    subDomain1: "",
    subDomain2: "",
    subject: "",
    description: "",
    website_url: "", // Anti-bot honeypot
  });

  // Check user session
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (isMounted && data.success && data.user) {
          setCurrentUser(data.user);
          // Autofill requester details if logged in
          setFormData((prev) => ({
            ...prev,
            requesterName: prev.requesterName || data.user.name || "",
            requesterEmail: prev.requesterEmail || data.user.email || "",
            requesterPhone: prev.requesterPhone || data.user.phone || "",
            sharePhoneWithStaff:
              data.user.defaultSharePhone !== undefined
                ? Boolean(data.user.defaultSharePhone)
                : prev.sharePhoneWithStaff,
          }));
          // If query param mode=editor or user has admin permissions, enable editor capability
          if (initialMode && (data.user.roleLevel === 1 || data.user.roleLevel === 2)) {
            setIsEditorActive(true);
          }
        }
      } catch (err) {
        // public visitor
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [initialMode]);

  // Dynamically fetch category configuration from server
  useEffect(() => {
    let isMounted = true;
    async function fetchCategoryDetails() {
      try {
        const res = await fetch(`/api/categories/${categorySlug}`);
        const data = await res.json();
        if (isMounted && data.success && data.category) {
          setCategory(data.category);
          setEditedCategory({
            ...data.category,
            locationOptions: Array.isArray(data.category.locationOptions)
              ? [...data.category.locationOptions]
              : [],
            customCascades: data.category.customCascades || {},
          });
          setFormData((prev) => ({
            ...prev,
            locationCategory: data.category.name,
            domain: prev.domain || data.category.allowedDomains?.[0] || "Electrical",
          }));
        }
      } catch (err) {
        // Fallback to static category
      }
    }
    fetchCategoryDetails();
    return () => {
      isMounted = false;
    };
  }, [categorySlug]);

  const canManage = Boolean(
    currentUser && (currentUser.roleLevel === 1 || currentUser.roleLevel === 2)
  ) || initialMode;

  // Derive active location options (combining custom DB locations with default campus lists)
  const displayLocations = useMemo(() => {
    const activeObj = isEditorActive ? editedCategory : category;
    if (activeObj.locationOptions && Array.isArray(activeObj.locationOptions) && activeObj.locationOptions.length > 0) {
      return activeObj.locationOptions;
    }
    if (activeObj.locationType === "academic") return ACADEMIC_BLOCKS;
    if (activeObj.locationType === "hostel") return activeObj.slug === "jeet_hostel" ? JEET_BLOCKS : HOSTEL_LIST;
    if (activeObj.locationType === "apartment") return HOUSING_APARTMENTS;
    if (activeObj.locationType === "general") {
      return [
        "Central Arcade",
        "Sports Complex & Gymnasium",
        "Institute Guest House",
        "Research Park & Innovation Centre",
        "Main Campus Roads & Lighting",
        "Substations & Utility Blocks",
        "Student Activity Centre (SAC)",
      ];
    }
    return [];
  }, [category, editedCategory, isEditorActive]);

  // Merged Cascades (standard DOMAIN_CASCADE + any customCascades saved in this category)
  const activeCascades = useMemo(() => {
    const activeObj = isEditorActive ? editedCategory : category;
    const base: Record<string, { sub1: Record<string, string[]> }> = {};
    for (const [k, v] of Object.entries(DOMAIN_CASCADE)) {
      base[k] = { sub1: { ...v.sub1 } };
    }

    if (activeObj.customCascades && typeof activeObj.customCascades === "object") {
      for (const [dom, data] of Object.entries(activeObj.customCascades as Record<string, any>)) {
        if (!base[dom]) {
          base[dom] = { sub1: {} };
        }
        if (data?.sub1) {
          base[dom].sub1 = {
            ...base[dom].sub1,
            ...data.sub1,
          };
        }
      }
    }
    return base;
  }, [category, editedCategory, isEditorActive]);

  // Attachments state
  const [attachments, setAttachments] = useState<
    Array<{ name: string; size: number; url: string }>
  >([]);
  const [annotatingUploadIdx, setAnnotatingUploadIdx] = useState<number | null>(null);

  // Apartment search filter
  const [apartmentSearch, setApartmentSearch] = useState("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    ticketNumber: string;
    trackingToken: string;
    department: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cascading SubDomains
  const currentSub1Options = useMemo(() => {
    if (!formData.domain || !activeCascades[formData.domain]) return [];
    return Object.keys(activeCascades[formData.domain].sub1);
  }, [formData.domain, activeCascades]);

  const currentSub2Options = useMemo(() => {
    if (
      !formData.domain ||
      !formData.subDomain1 ||
      !activeCascades[formData.domain]?.sub1[formData.subDomain1]
    ) {
      return [];
    }
    return activeCascades[formData.domain].sub1[formData.subDomain1];
  }, [formData.domain, formData.subDomain1, activeCascades]);

  // Handle Domain Change
  const handleDomainChange = (domain: string) => {
    setFormData((prev) => ({
      ...prev,
      domain,
      subDomain1: "",
      subDomain2: "",
    }));
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 3) {
      alert("Maximum 3 photo attachments allowed.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select image files (JPG, PNG, WebP) only.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("File size exceeds 8MB limit.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachments((prev) => [
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

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // Editor Actions
  // -------------------------------------------------------------
  const handleAddLocationItem = () => {
    const item = newLocationInput.trim();
    if (!item) return;

    const currentLocs = Array.isArray(editedCategory.locationOptions) && editedCategory.locationOptions.length > 0
      ? [...editedCategory.locationOptions]
      : [...displayLocations];

    if (!currentLocs.includes(item)) {
      currentLocs.push(item);
    }

    setEditedCategory((prev: any) => ({
      ...prev,
      locationOptions: currentLocs,
    }));
    setNewLocationInput("");
  };

  const handleRemoveLocationItem = (itemToRemove: string) => {
    const currentLocs = Array.isArray(editedCategory.locationOptions) && editedCategory.locationOptions.length > 0
      ? [...editedCategory.locationOptions]
      : [...displayLocations];

    const updated = currentLocs.filter((item: string) => item !== itemToRemove);
    setEditedCategory((prev: any) => ({
      ...prev,
      locationOptions: updated,
    }));
  };

  const handleResetLocationOptions = () => {
    let standard: string[] = [];
    if (editedCategory.locationType === "academic") standard = [...ACADEMIC_BLOCKS];
    else if (editedCategory.locationType === "hostel") {
      standard = editedCategory.slug === "jeet_hostel" ? [...JEET_BLOCKS] : [...HOSTEL_LIST];
    } else if (editedCategory.locationType === "apartment") standard = [...HOUSING_APARTMENTS];
    else {
      standard = [
        "Central Arcade",
        "Sports Complex & Gymnasium",
        "Institute Guest House",
        "Research Park & Innovation Centre",
        "Main Campus Roads & Lighting",
        "Substations & Utility Blocks",
        "Student Activity Centre (SAC)",
      ];
    }

    setEditedCategory((prev: any) => ({
      ...prev,
      locationOptions: standard,
    }));
  };

  const handleToggleDomainInEditor = (dom: string) => {
    const current = editedCategory.allowedDomains || [];
    let updated: string[];
    if (current.includes(dom)) {
      if (current.length <= 1) {
        alert("At least one engineering domain must remain allowed.");
        return;
      }
      updated = current.filter((d: string) => d !== dom);
    } else {
      updated = [...current, dom];
    }

    setEditedCategory((prev: any) => ({
      ...prev,
      allowedDomains: updated,
    }));
  };

  const handleAddCustomFaultCascade = () => {
    if (!newSub1Input.trim()) return;
    const dom = selectedCascadeDomain;
    const sub1 = newSub1Input.trim();
    const symptoms = newSub2Input
      ? newSub2Input.split(",").map((s) => s.trim()).filter(Boolean)
      : ["General Inspection Required", "Repair Required"];

    const currentCascades = { ...(editedCategory.customCascades || {}) };
    if (!currentCascades[dom]) {
      currentCascades[dom] = { sub1: {} };
    }
    if (!currentCascades[dom].sub1) {
      currentCascades[dom].sub1 = {};
    }

    currentCascades[dom].sub1[sub1] = symptoms;

    setEditedCategory((prev: any) => ({
      ...prev,
      customCascades: currentCascades,
    }));
    setNewSub1Input("");
    setNewSub2Input("");
  };

  const handleSaveAllCategoryChanges = async () => {
    setIsSavingCategory(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await fetch(`/api/categories/${category.id || category.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedCategory.name,
          shortDescription: editedCategory.shortDescription,
          locationType: editedCategory.locationType,
          hasCorridor: editedCategory.hasCorridor,
          allowedDomains: editedCategory.allowedDomains,
          locationOptions: editedCategory.locationOptions,
          responseTimeText: editedCategory.responseTimeText,
          bannerNotice: editedCategory.bannerNotice,
          instructions: editedCategory.instructions,
          urgencyPrompt: editedCategory.urgencyPrompt,
          customCascades: editedCategory.customCascades,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update category.");
      }

      setCategory(data.category);
      setEditedCategory(data.category);
      setSaveSuccessMsg(`Saved! "${data.category.name}" and all buildings/locations updated live.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || "Failed to save changes.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  // -------------------------------------------------------------
  // Public Form Submission
  // -------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditorActive) {
      alert("You are currently in Editor Mode. Click 'Preview Public View' in the top bar to test submission.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    if (formData.website_url) {
      setIsSubmitting(false);
      return;
    }

    const cleanedPhone = formData.requesterPhone ? formData.requesterPhone.replace(/\D/g, "") : "";
    if (cleanedPhone && cleanedPhone.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number, or leave it blank.");
      setIsSubmitting(false);
      return;
    }

    if (!formData.requesterEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      setIsSubmitting(false);
      return;
    }

    let locationDetail = "";
    if (category.locationType === "apartment") {
      locationDetail = `Apartment ${formData.locationPrimary}`;
      if (formData.corridor) {
        locationDetail += ` (${formData.corridor})`;
      }
    } else if (category.locationType === "hostel" || category.locationType === "academic") {
      locationDetail = `${formData.locationPrimary} - ${formData.locationRoom}`;
    } else {
      locationDetail = formData.locationRoom;
    }

    const payload = {
      category: category.slug,
      domain: formData.domain,
      subDomain1: formData.subDomain1,
      subDomain2: formData.subDomain2 || null,
      requesterName: formData.requesterName,
      requesterEmail: formData.requesterEmail,
      requesterPhone: cleanedPhone || null,
      sharePhoneWithStaff: cleanedPhone ? Boolean(formData.sharePhoneWithStaff) : false,
      locationCategory: category.name,
      locationDetail,
      corridor: formData.corridor || null,
      availability: `${formData.preferredDate} (${formData.preferredStartTime} - ${formData.preferredEndTime})`,
      subject: formData.subject,
      description: formData.description,
      priority: "NORMAL",
      isUrgent: false,
      website_url: formData.website_url,
      attachments,
    };

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setSubmissionResult({
        ticketNumber: data.ticketNumber,
        trackingToken: data.trackingToken,
        department: data.department,
      });

      // Only save to device storage for guest/unregistered users.
      // Logged-in users' requests are securely tied to their account in the database.
      if (!currentUser) {
        saveTicketToStorage({
          ticketNumber: data.ticketNumber,
          token: data.trackingToken,
          subject: formData.subject,
          category: category.name,
          domain: formData.domain,
          departmentName:
            typeof data.department === "string"
              ? data.department
              : data.department?.name || category.name,
          locationDetail,
          status: "SUBMITTED",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const trackingUrl = submissionResult
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/track/${submissionResult.ticketNumber
    }?token=${submissionResult.trackingToken}`
    : "";

  const copyTrackingLink = () => {
    if (navigator.clipboard && trackingUrl) {
      navigator.clipboard.writeText(trackingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // SUCCESS CONFIRMATION SCREEN
  if (submissionResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6 text-slate-900 dark:text-white">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              Registration Successful
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Maintenance Request Submitted
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Your complaint has been automatically routed to the{" "}
              <strong className="text-slate-700 dark:text-slate-200">{submissionResult.department}</strong>.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Your Complaint Ticket Number
            </p>
            <p className="text-xl sm:text-3xl md:text-4xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-tight break-all">
              {submissionResult.ticketNumber}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Save this number or your tracking link to check status, communicate with technicians, or escalate.
            </p>
          </div>

          <div className="space-y-2 text-left bg-indigo-50/60 dark:bg-indigo-950/40 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
            <label className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
              <span>Secret Tracking Link (No Login Required)</span>
              {copiedLink && (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">Link Copied!</span>
              )}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="w-full text-xs font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/60 text-slate-600 dark:text-slate-300 select-all"
              />
              <button
                type="button"
                onClick={copyTrackingLink}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/track/${submissionResult.ticketNumber}?token=${submissionResult.trackingToken}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-500/20"
            >
              <span>View Complaint Tracker</span>
              <ExternalLink className="w-4 h-4 ml-2" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmissionResult(null);
                setFormData((prev) => ({
                  ...prev,
                  subject: "",
                  description: "",
                  subDomain1: "",
                  subDomain2: "",
                }));
                setAttachments([]);
              }}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCategoryObj = isEditorActive ? editedCategory : category;

  return (
    <div className="min-h-screen pb-16">
      {/* ------------------------------------------------------------- */}
      {/* FLOATING ADMIN LIVE FORM BUILDER TOOLBAR                      */}
      {/* ------------------------------------------------------------- */}
      {canManage && (
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-xl px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-400/30">
                    Live Form Customizer
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    Editing: {currentCategoryObj.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isEditorActive
                    ? "In-place editor active. Add buildings, complexes, change trades, and configure options."
                    : "Previewing actual public requester view. Switch to Editor to make changes."}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0 flex-wrap">
              {isEditorActive ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveAllCategoryChanges}
                    disabled={isSavingCategory}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCategory ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingCategory ? "Saving..." : "Save All Changes"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditorActive(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
                    title="Preview what residents see"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Public View</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditorActive(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Switch to Editor Mode</span>
                </button>
              )}

              <Link
                href="/admin"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Back to Admin
              </Link>
            </div>
          </div>

          {/* Feedback messages */}
          {saveSuccessMsg && (
            <div className="max-w-5xl mx-auto mt-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
          {saveErrorMsg && (
            <div className="max-w-5xl mx-auto mt-2 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{saveErrorMsg}</span>
            </div>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Categories
          </Link>

          {!canManage && (
            <Link
              href="/admin"
              className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Institute Staff Login
            </Link>
          )}
        </div>

        {/* Announcement / Emergency Notice Banner if configured */}
        {currentCategoryObj.bannerNotice && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-start space-x-3 text-xs shadow-xs">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{currentCategoryObj.bannerNotice}</div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* HEADER BANNER (WITH IN-PLACE EDITOR CONTROLS)                 */}
        {/* ------------------------------------------------------------- */}
        <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border shadow-xs mb-8 transition-all ${isEditorActive ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"
          }`}>
          {isEditorActive ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                  <span>Editor Active • Zone Header & Public Details</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Slug: /new/{currentCategoryObj.slug}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Zone Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editedCategory.name || ""}
                    onChange={(e) =>
                      setEditedCategory((prev: any) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Academic Complex & Labs"
                    className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Response SLA Badge Text
                  </label>
                  <input
                    type="text"
                    value={editedCategory.responseTimeText || ""}
                    onChange={(e) =>
                      setEditedCategory((prev: any) => ({
                        ...prev,
                        responseTimeText: e.target.value,
                      }))
                    }
                    placeholder="e.g. Avg Response: < 24 hrs"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Public Description & Guidance
                </label>
                <textarea
                  rows={2}
                  value={editedCategory.shortDescription || ""}
                  onChange={(e) =>
                    setEditedCategory((prev: any) => ({
                      ...prev,
                      shortDescription: e.target.value,
                    }))
                  }
                  placeholder="e.g. Lecture halls, classrooms, faculty offices, student labs, and research facilities."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seasonal Notice / Announcement Banner (Optional)
                </label>
                <input
                  type="text"
                  value={editedCategory.bannerNotice || ""}
                  onChange={(e) =>
                    setEditedCategory((prev: any) => ({
                      ...prev,
                      bannerNotice: e.target.value,
                    }))
                  }
                  placeholder="e.g. Notice: Annual AC servicing underway this weekend across Academic Blocks 1-4."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 sm:py-1 rounded-full border border-indigo-200 dark:border-indigo-900/60">
                  Open Complaint Registration
                </span>
                <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 sm:mt-2">
                  {currentCategoryObj.name}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  {currentCategoryObj.shortDescription}. Open access for all IIT Gandhinagar residents and members.
                </p>
              </div>
              <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>{currentCategoryObj.responseTimeText || "Avg Response: < 24 hrs"}</span>
                </div>
                {currentUser ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900/60 text-indigo-800 dark:text-indigo-300 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span>Mode: <strong>{currentUser.roleName || currentUser.roleCode}</strong> ({currentUser.name})</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Mode: <strong>Guest (Single Complaint)</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Honeypot field */}
          <input
            type="text"
            name="website_url"
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
            className="hidden"
            autoComplete="off"
            tabIndex={-1}
          />

          {/* Section 1: Requester Details */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Requester Contact Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your details for repair updates and technician visit coordination.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.requesterName}
                  onChange={(e) => setFormData({ ...formData, requesterName: e.target.value })}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.requesterEmail}
                  onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
                  placeholder="e.g. name@iitgn.ac.in"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Phone Number <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Email is default</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={formData.requesterPhone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requesterPhone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="e.g. 9876543210 (Optional)"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {formData.requesterPhone ? (
                  <div className="mt-2.5 flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                    <input
                      type="checkbox"
                      id="sharePhoneWithStaff"
                      checked={formData.sharePhoneWithStaff}
                      onChange={(e) => setFormData({ ...formData, sharePhoneWithStaff: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="sharePhoneWithStaff" className="text-slate-700 dark:text-slate-300 cursor-pointer leading-tight">
                      <span className="font-semibold block text-slate-800 dark:text-slate-200">
                        Share phone with assigned technician
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formData.sharePhoneWithStaff
                          ? "Technicians can call directly for location access or urgent field coordination."
                          : "Private: Technicians will only contact you via institutional email and in-app chat."}
                      </span>
                    </label>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    If left blank, all communications will happen strictly via your institutional email and in-app chat.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 2: FAULT LOCATION DETAILS & BUILDINGS MANAGER         */}
          {/* ------------------------------------------------------------- */}
          <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border shadow-xs space-y-6 transition-all ${isEditorActive ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"
            }`}>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Fault Location Details</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accurate location ensures technicians reach the right room without delay.
                </p>
              </div>

              {isEditorActive && (
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  ⚙️ Building & Location Manager Active
                </span>
              )}
            </div>

            {/* IN EDITOR MODE: BUILDINGS & LOCATIONS MANAGEMENT CARD */}
            {isEditorActive && (
              <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Manage Buildings, Hostels & Complexes ({displayLocations.length} Registered)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationsManager(!showLocationsManager)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                  >
                    <span>{showLocationsManager ? "Hide List" : "Show List"}</span>
                    {showLocationsManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showLocationsManager && (
                  <div className="space-y-3">
                    {/* Add new location item */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddLocationItem();
                          }
                        }}
                        placeholder={`+ Add New ${editedCategory.locationType === "academic"
                          ? "Complex / Building (e.g. Academic Complex 5 (AB 5), Design Studio)"
                          : editedCategory.locationType === "hostel"
                            ? "Hostel Block (e.g. Hostel 13, Block E)"
                            : "Building, Flat, or Location..."
                          }`}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddLocationItem}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetLocationOptions}
                        className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 shrink-0 flex items-center space-x-1 cursor-pointer"
                        title="Reset to campus standard master list"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Defaults</span>
                      </button>
                    </div>

                    {/* Chips grid */}
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
                      {displayLocations.map((locItem: string) => (
                        <span
                          key={locItem}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold"
                        >
                          <span>{locItem}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocationItem(locItem)}
                            className="text-indigo-400 hover:text-rose-600 transition-colors p-0.5"
                            title={`Remove ${locItem}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Style switcher & Corridor toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100">
                      <div>
                        <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                          Location Input Style
                        </label>
                        <select
                          value={editedCategory.locationType}
                          onChange={(e) =>
                            setEditedCategory((prev: any) => ({
                              ...prev,
                              locationType: e.target.value,
                            }))
                          }
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="academic">Academic Complex / Building + Room/Lab</option>
                          <option value="hostel">Hostel Block + Room</option>
                          <option value="apartment">Residential Flat (Block/Apartment)</option>
                          <option value="general">General Campus Description</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2 pt-4">
                        <input
                          type="checkbox"
                          id="editorHasCorridor"
                          checked={editedCategory.hasCorridor || false}
                          onChange={(e) =>
                            setEditedCategory((prev: any) => ({
                              ...prev,
                              hasCorridor: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                        <label
                          htmlFor="editorHasCorridor"
                          className="text-xs text-indigo-950 font-medium cursor-pointer"
                        >
                          Include Corridor / Wing field in public form
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standard Form Inputs (Driven by updated locations) */}
            {currentCategoryObj.locationType === "apartment" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Apartment Unit (Block / Flat No.) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Search apartment number (e.g. 14/203)..."
                      value={apartmentSearch}
                      onChange={(e) => setApartmentSearch(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <select
                    required
                    value={formData.locationPrimary}
                    onChange={(e) => setFormData({ ...formData, locationPrimary: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Apartment ({displayLocations.length} Registered Units) --</option>
                    {displayLocations
                      .filter((apt: string) =>
                        apt.toLowerCase().includes(apartmentSearch.toLowerCase())
                      )
                      .map((apt: string) => (
                        <option key={apt} value={apt}>
                          Apartment {apt}
                        </option>
                      ))}
                  </select>
                </div>

                {currentCategoryObj.hasCorridor && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Corridor / Wing (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.corridor}
                      onChange={(e) => setFormData({ ...formData, corridor: e.target.value })}
                      placeholder="e.g. Ground Floor East Wing / Near Lift"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {currentCategoryObj.locationType === "hostel" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Hostel Block <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.locationPrimary}
                    onChange={(e) => setFormData({ ...formData, locationPrimary: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Hostel ({displayLocations.length} Available) --</option>
                    {displayLocations.map((h: string) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Room Number / Floor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.locationRoom}
                    onChange={(e) => setFormData({ ...formData, locationRoom: e.target.value })}
                    placeholder="e.g. Room 312 or 2nd Floor Common Washroom"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {currentCategoryObj.locationType === "academic" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Academic Complex / Building <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.locationPrimary}
                    onChange={(e) => setFormData({ ...formData, locationPrimary: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Complex ({displayLocations.length} Available) --</option>
                    {displayLocations.map((ab: string) => (
                      <option key={ab} value={ab}>
                        {ab}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Room, Lab, or Office Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.locationRoom}
                    onChange={(e) => setFormData({ ...formData, locationRoom: e.target.value })}
                    placeholder="e.g. Lab 204 or Classroom 1/101"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {currentCategoryObj.locationType === "general" && (
              <div className="space-y-4">
                {displayLocations.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Campus Facility / Landmark
                    </label>
                    <select
                      value={formData.locationPrimary}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          locationPrimary: e.target.value,
                          locationRoom: e.target.value || formData.locationRoom,
                        })
                      }
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 mb-2"
                    >
                      <option value="">-- Choose Facility ({displayLocations.length} Registered) --</option>
                      {displayLocations.map((loc: string) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Specific Location Details <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.locationRoom}
                    onChange={(e) => setFormData({ ...formData, locationRoom: e.target.value })}
                    placeholder="e.g. Central Arcade Shop 4 or Sports Ground North Pole Light"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Preferred Visit Time - 3 Selectors: Date, Start Time, End Time */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Preferred Technician Visit Window <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Date Selector */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Visit Date
                  </span>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* 2. Start Time Selector */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Earliest Start Time
                  </span>
                  <input
                    type="time"
                    required
                    value={formData.preferredStartTime}
                    onChange={(e) => setFormData({ ...formData, preferredStartTime: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* 3. End Time Selector */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Latest End Time
                  </span>
                  <input
                    type="time"
                    required
                    value={formData.preferredEndTime}
                    onChange={(e) => setFormData({ ...formData, preferredEndTime: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {formData.preferredDate && formData.preferredStartTime && formData.preferredEndTime && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    Availability logged:{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {new Date(formData.preferredDate + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>{" "}
                    between{" "}
                    <strong className="text-slate-700 dark:text-slate-200">{formData.preferredStartTime}</strong> and{" "}
                    <strong className="text-slate-700 dark:text-slate-200">{formData.preferredEndTime}</strong>
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 3: NATURE OF MAINTENANCE FAULT & DOMAINS             */}
          {/* ------------------------------------------------------------- */}
          <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border shadow-xs space-y-6 transition-all ${isEditorActive ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"
            }`}>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Nature of Maintenance Fault</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pick the domain and cascading category to automatically assign the trade specialist.
                </p>
              </div>

              {isEditorActive && (
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  ⚙️ Trades & Fault Hierarchy Active
                </span>
              )}
            </div>

            {/* Allowed Domains Radio Pills / Trade Customizer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Maintenance Domain <span className="text-rose-500">*</span>
                </label>
                {isEditorActive && (
                  <span className="text-[11px] text-slate-400">
                    Click ✕ to remove or toggle available trades below
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(currentCategoryObj.allowedDomains || []).map((dom: string) => (
                  <div key={dom} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleDomainChange(dom)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center space-x-1.5 ${formData.domain === dom
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <span>{dom}</span>
                    </button>

                    {isEditorActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleDomainInEditor(dom);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] hover:bg-rose-700 shadow-xs cursor-pointer"
                        title={`Remove ${dom} trade from this zone`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* In Editor Mode: Add more domains */}
              {isEditorActive && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    + Add or Enable Additional Trades for this Zone:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_POSSIBLE_DOMAINS.filter(
                      (dom) => !(editedCategory.allowedDomains || []).includes(dom)
                    ).map((dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => handleToggleDomainInEditor(dom)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/70 hover:border-indigo-300 hover:text-indigo-600 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{dom}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* In Editor Mode: Custom Cascading Fault Items Builder */}
            {isEditorActive && (
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Add Custom Fault Categories & Symptoms to this Zone
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCascadeManager(!showCascadeManager)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                  >
                    <span>{showCascadeManager ? "Close" : "Open Customizer"}</span>
                    {showCascadeManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showCascadeManager && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Trade Domain
                        </label>
                        <select
                          value={selectedCascadeDomain}
                          onChange={(e) => setSelectedCascadeDomain(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          {(editedCategory.allowedDomains || []).map((d: string) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          New Fault Category (SubDomain 1)
                        </label>
                        <input
                          type="text"
                          value={newSub1Input}
                          onChange={(e) => setNewSub1Input(e.target.value)}
                          placeholder="e.g. Smart Projector / AV"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Symptoms (Comma-separated)
                        </label>
                        <input
                          type="text"
                          value={newSub2Input}
                          onChange={(e) => setNewSub2Input(e.target.value)}
                          placeholder="e.g. HDMI No Signal, Audio Buzzing"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddCustomFaultCascade}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Fault Category</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cascading SubDomain 1 and SubDomain 2 Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Fault Category (Sub-domain 1) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.subDomain1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      subDomain1: e.target.value,
                      subDomain2: "",
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Category ({currentSub1Options.length} Options) --</option>
                  {currentSub1Options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Specific Symptom / Item (Sub-domain 2)
                </label>
                <select
                  value={formData.subDomain2}
                  disabled={currentSub2Options.length === 0}
                  onChange={(e) => setFormData({ ...formData, subDomain2: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">-- Choose Specific Issue ({currentSub2Options.length} Options) --</option>
                  {currentSub2Options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Subject Summary <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g. Ceiling fan regulator not controlling speed"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Detailed Description (Optional)
                </label>
                <span className="text-[11px] text-slate-400">
                  {formData.description.length}/500 chars
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide any additional context or details..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Photo Attachments - Guest users are NOT allowed to add images */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Attach Photos of Fault <span className="font-normal text-slate-500 dark:text-slate-400 text-[11px]">(Max 3 images, 8MB each)</span>
                </label>
                {currentUser ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Verified Resident: {currentUser.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Guest Mode (No Photos)
                  </span>
                )}
              </div>

              {currentUser ? (
                <div className="space-y-3">
                  {attachments.length < 3 && (
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all group">
                      <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-1 transition-colors" />
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                        {attachments.length === 0 ? "Click to upload fault photos" : "Add another photo"}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        JPEG, PNG, or WebP ({3 - attachments.length} slot{3 - attachments.length === 1 ? "" : "s"} remaining)
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
                        >
                          {/* Fixed size photo frame */}
                          <div className="relative h-40 w-full bg-slate-950 overflow-hidden shrink-0">
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              aria-label="Remove photo"
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/85 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer shadow-md z-10"
                              title="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Card Footer: File Info + Dedicated Edit Button */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                {att.name}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {(att.size / 1024).toFixed(0)} KB
                              </p>
                            </div>

                            {/* Edit / Annotate Button */}
                            <button
                              type="button"
                              onClick={() => setAnnotatingUploadIdx(idx)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-indigo-200/60 dark:border-indigo-800/60 active:scale-95 shadow-2xs group/btn"
                              title="Edit photo (Draw markings or arrows)"
                            >
                              <Pen className="w-3 h-3 text-indigo-500 dark:text-indigo-400 group-hover/btn:text-white transition-colors" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100/80 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/50 mt-0.5">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Photo Uploads Reserved for Verified Residents
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        To maintain institutional infrastructure security, attaching photos requires a resident login. You can submit this complaint directly without images, or sign in now.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/login?redirect=/new/${categorySlug}`}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs text-center transition-all shadow-xs"
                  >
                    Sign In to Add Photos
                  </Link>
                </div>
              )}
            </div>

            {/* 24x7 Emergency Control Room Notice Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-bold text-xs text-amber-950 dark:text-amber-100">
                  Active Safety Hazard or Emergency?
                </span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                For active hazards requiring immediate physical intervention (e.g. sparking switchboard, active flooding, gas leak, bare wires), do not wait for regular ticket processing. Please dial the <strong>24x7 Campus Maintenance Control Room</strong> immediately:
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs font-semibold text-amber-950 dark:text-amber-100">
                <a
                  href="tel:07923952000"
                  className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-200 hover:text-amber-700 dark:hover:text-amber-100 hover:underline"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>079-2395-2000 (Internal Ext: 2000)</span>
                </a>
                <span className="text-amber-400 hidden sm:inline">•</span>
                <a
                  href="tel:07923952026"
                  className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-200 hover:text-amber-700 dark:hover:text-amber-100 hover:underline"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>079-2395-2026</span>
                </a>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              By submitting, your complaint will be logged with the Institute Works Department.
            </p>

            <button
              type="submit"
              disabled={isSubmitting || isEditorActive}
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center ${isEditorActive
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 disabled:opacity-60"
                }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : isEditorActive ? (
                <span>Switch to Public View to Submit</span>
              ) : (
                <span>Submit</span>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Photo Annotation Modal before submission */}
      {annotatingUploadIdx !== null && attachments[annotatingUploadIdx] && (
        <ImageLightboxModal
          images={[
            {
              url: attachments[annotatingUploadIdx].url,
              name: attachments[annotatingUploadIdx].name || "Fault Photo",
            },
          ]}
          startInDrawMode={true}
          onClose={() => setAnnotatingUploadIdx(null)}
          onSaveAnnotation={(annotatedUrl) => {
            setAttachments((prev) =>
              prev.map((item, i) =>
                i === annotatingUploadIdx ? { ...item, url: annotatedUrl } : item
              )
            );
            setAnnotatingUploadIdx(null);
          }}
        />
      )}
    </div>
  );
}
