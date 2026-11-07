"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Send,
  ShieldAlert,
  Loader2,
  Phone,
  RefreshCw,
  MessageSquare,
  Lock,
  KeyRound,
  ShieldCheck,
  Archive,
  Trash2,
  Camera,
  Paperclip,
  X,
  Eye,
  ExternalLink,
  Check,
  CheckCheck,
  Copy,
  Sparkles,
  MessageCircle,
  ArrowRight,
  ArrowUpRight,
  Pen,
  Wrench,
  PhoneCall,
  Mail,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  getTicketTokenFromStorage,
  saveTicketToStorage,
  removeTicketFromStorage,
} from "@/lib/storage/ticketStorage";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import EvidencePhotosGallery from "@/components/EvidencePhotosGallery";

const STATUS_STEPS = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "ACKNOWLEDGED", label: "Acknowledged" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "CLOSED", label: "Closed" },
];

const PREDEFINED_PROGRESSION_REASONS = [
  { code: "ARRIVED_ON_SITE", label: "Arrived on site • Work started" },
  { code: "PARTS_RETRIEVED", label: "Parts retrieved from inventory" },
  { code: "DIAGNOSTICS_COMPLETED", label: "Inspection & diagnostics completed" },
  { code: "FAULT_FIXED_VERIFIED", label: "Fault repaired & verified operational" },
  { code: "COMPONENTS_REPLACED", label: "Components replaced and tested" },
  { code: "RESIDENT_CONFIRMED", label: "Issue resolved & confirmed with resident" },
  { code: "AWAITING_PARTS", label: "Awaiting spare parts from store" },
  { code: "WORK_COMPLETED_CLOSED", label: "Work order completed and closed" },
];

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

function formatReopenRemaining(deadlineIso: string, currentTimeMs: number = Date.now()): {
  remainingText: string;
  endDateText: string;
  isExpired: boolean;
} {
  if (!deadlineIso) {
    return { remainingText: "", endDateText: "", isExpired: true };
  }
  const deadline = new Date(deadlineIso);
  const diffMs = deadline.getTime() - currentTimeMs;

  if (diffMs <= 0) {
    return { remainingText: "0 minutes remaining", endDateText: "", isExpired: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0 || (days === 0 && hours === 0)) {
    parts.push(`${Math.max(1, minutes)} ${minutes === 1 ? "minute" : "minutes"}`);
  }

  const remainingText = `${parts.join(" ")} remaining`;

  const endDateText = `Ends on ${deadline.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })} at ${deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return { remainingText, endDateText, isExpired: false };
}

function SingleTicketTrackContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = params?.ticketNumber as string;
  const token = searchParams.get("token") || "";

  const [request, setRequest] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState(Date.now());

  // Keep countdown timer fresh every 15 seconds
  useEffect(() => {
    if (!request?.canReopen || !request?.reopenDeadline) return;
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, [request?.canReopen, request?.reopenDeadline]);

  // Identity Verification Challenge State (for cross-device access / laptop view)
  const [verificationMethod, setVerificationMethod] = useState<"token" | "dual">("dual");
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [verifyEmailInput, setVerifyEmailInput] = useState("");
  const [verifyPhoneInput, setVerifyPhoneInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Follow-up comment state
  const [commentText, setCommentText] = useState("");
  const [attachedPhotos, setAttachedPhotos] = useState<
    { name: string; size: number; type: string; url: string }[]
  >([]);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Authenticated user session state
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Reopen state
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [showReopenBox, setShowReopenBox] = useState(false);

  // Escalation state
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationSuccess, setEscalationSuccess] = useState<string | null>(null);

  // Delete Request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Staff / Technician Quick Status Update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusActionNote, setStatusActionNote] = useState("");
  const [selectedPredefinedReason, setSelectedPredefinedReason] = useState("");
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Resident phone sharing privacy state
  const [isTogglingPhonePrivacy, setIsTogglingPhonePrivacy] = useState(false);

  // Lightbox Image Gallery state (Full view with zoom, pan, drawing & back-button support)
  const [lightboxGallery, setLightboxGallery] = useState<{
    images: { url: string; name: string }[];
    initialIndex: number;
  } | null>(null);
  const [annotatingAttachedPhotoIdx, setAnnotatingAttachedPhotoIdx] = useState<number | null>(null);

  const openLightbox = (images: { url: string; name: string }[], initialIndex: number = 0) => {
    setLightboxGallery({ images, initialIndex });
  };

  // Unread chat message tracker for Small Chat
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  // Ref for auto-scrolling to newest message in Follow-up Notes
  const followUpContainerRef = useRef<HTMLDivElement>(null);

  // Copied ticket indicator
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Scroll follow-up container to the bottom (newest message) by default
  useEffect(() => {
    if (followUpContainerRef.current) {
      followUpContainerRef.current.scrollTop = followUpContainerRef.current.scrollHeight;
    }
  }, [request?.followUps]);

  // Fetch session on load
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => { });
  }, []);

  // Track unread messages in small chat (Follow-up Notes & Updates)
  useEffect(() => {
    if (!request?.followUps || request.followUps.length === 0) {
      setFirstUnreadId(null);
      return;
    }
    const storageKey = `last_read_track_${ticketId}_${currentUser?.id || currentUser?.roleCode || "resident"}`;
    const rawLastRead = localStorage.getItem(storageKey);

    // Initial visit: initialize lastRead to current time so baseline existing history isn't marked as new
    if (rawLastRead === null) {
      localStorage.setItem(storageKey, String(Date.now()));
      setFirstUnreadId(null);
      return;
    }

    const lastRead = Number(rawLastRead);
    const isStaffOrAdmin =
      currentUser &&
      (currentUser.roleCode === "OVERALL_ADMIN" ||
        currentUser.roleCode === "DEPT_ADMIN" ||
        currentUser.roleCode === "DEPT_STAFF");

    // In Follow-up Notes & Updates, messages are in chronological order (oldest at top, newest at bottom).
    // Unread messages from counterparty:
    const unreadMessages = request.followUps.filter((msg: any) => {
      const msgTime = new Date(msg.createdAt).getTime();
      const isFromCounterparty = isStaffOrAdmin
        ? msg.authorRole === "requester"
        : msg.authorRole !== "requester";
      return msgTime > lastRead && isFromCounterparty;
    });

    if (unreadMessages.length > 0) {
      // In ascending order, the first unread message is the oldest among the unread group.
      // The divider "New Messages Below" appears right above this message!
      const oldestUnread = [...unreadMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      setFirstUnreadId(oldestUnread.id);
    } else {
      setFirstUnreadId(null);
    }

    // Mark as read after 4 seconds of viewing
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, String(Date.now()));
    }, 4000);

    return () => clearTimeout(timer);
  }, [request?.followUps, ticketId, currentUser]);

  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const res = await fetch("/api/requests/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketNumber: ticketId,
          token: verificationMethod === "token" ? verifyTokenInput.trim() : undefined,
          email: verificationMethod === "dual" ? verifyEmailInput.trim() : undefined,
          phone: verificationMethod === "dual" ? verifyPhoneInput.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Verification failed.");
      }

      // Success! Fetch full request with the unlocked token
      const unlockedToken = data.token;
      const reqRes = await fetch(`/api/requests/${ticketId}?token=${unlockedToken}`);
      const reqData = await reqRes.json();
      if (!reqRes.ok || !reqData.success) {
        throw new Error(reqData.error || "Failed to load request.");
      }

      setRequest(reqData.request);
      setErrorMsg(null);

      // Save verified token to device storage for future auto-unlock (guest users only)
      if (!currentUser) {
        saveTicketToStorage({
          ticketNumber: reqData.request.ticketNumber,
          token: unlockedToken,
          subject: reqData.request.subject,
          category: reqData.request.category,
          domain: reqData.request.domain,
          departmentName: reqData.request.department?.name,
          locationDetail: reqData.request.locationDetail,
          status: reqData.request.status,
          createdAt: reqData.request.createdAt,
        });
      }

      // Quietly update the browser URL with token so bookmarking/refreshing works
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/track/${ticketId}?token=${unlockedToken}`);
      }
    } catch (err: any) {
      setVerificationError(err.message || "Invalid credentials. Access denied.");
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchRequest = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Resolve token: either from URL search params or from resident's local storage
      let effectiveToken = token;
      if (!effectiveToken) {
        const storedToken = getTicketTokenFromStorage(ticketId);
        if (storedToken) {
          effectiveToken = storedToken;
        }
      }

      const url = `/api/requests/${ticketId}${effectiveToken ? `?token=${effectiveToken}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to find request.");
      }
      setRequest((prev: any) => ({
        ...prev,
        ...data.request,
        followUps: data.request?.followUps ?? prev?.followUps ?? [],
        attachments: data.request?.attachments ?? prev?.attachments ?? [],
      }));

      // If loaded using stored token, quietly update URL
      if (effectiveToken && !token && typeof window !== "undefined") {
        window.history.replaceState(null, "", `/track/${ticketId}?token=${effectiveToken}`);
      }

      // Sync updated status & metadata to storage (guest users only)
      if (!currentUser && effectiveToken && data.request) {
        saveTicketToStorage({
          ticketNumber: data.request.ticketNumber,
          token: effectiveToken,
          subject: data.request.subject,
          category: data.request.category,
          domain: data.request.domain,
          departmentName: data.request.department?.name,
          locationDetail: data.request.locationDetail,
          status: data.request.status,
          createdAt: data.request.createdAt,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load request details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchRequest();
    }
  }, [ticketId, token]);

  // Handle Photo selection from camera or file picker
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentUser) {
      alert("Photos are not allowed for guest users. Please sign in with your IITGN account to attach photos.");
      return;
    }

    if (attachedPhotos.length + files.length > 3) {
      alert("You can attach up to 3 photos.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Only image files (JPG, PNG, WebP) are supported.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("File size exceeds 8MB limit.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachedPhotos((prev) => [
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

  const handleRemovePhoto = (index: number) => {
    setAttachedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Direct reply from photo lightbox modal
  const handleDirectReplyFromPhoto = async (
    annotatedPhoto: { url: string; name: string },
    replyText?: string
  ) => {
    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";
    const res = await fetch(`/api/requests/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: (replyText && replyText.trim()) || "Annotated photo attached pointing out issue.",
        attachments: [
          {
            name: annotatedPhoto.name,
            size: 60000,
            type: "image/png",
            url: annotatedPhoto.url,
          },
        ],
        token: effectiveToken,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to post reply with photo");
    }
    fetchRequest();
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && attachedPhotos.length === 0) {
      alert("Please enter a note or attach a photo.");
      return;
    }

    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";

    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/requests/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commentText.trim(),
          attachments: attachedPhotos,
          token: effectiveToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to post comment");
      }
      setCommentText("");
      setAttachedPhotos([]);
      if (data.reopened) {
        alert("Your follow-up note was posted and the ticket was automatically moved back to IN PROGRESS!");
      }
      fetchRequest();
    } catch (err: any) {
      alert(err.message || "Could not post comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleConfirmFixed = async () => {
    if (!confirm("Are you sure the fault is resolved? This will close the request. You will have a 15-minute grace window if you need to reopen.")) {
      return;
    }
    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";
    try {
      const res = await fetch(`/api/requests/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CLOSED",
          token: effectiveToken,
          note: "Requester confirmed fault resolved and closed the complaint.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.request) {
          setRequest((prev: any) => ({
            ...prev,
            ...data.request,
            followUps: data.request.followUps || prev?.followUps || [],
            attachments: data.request.attachments || prev?.attachments || [],
          }));
        }
        fetchRequest(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStaffUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      const predefinedObj = PREDEFINED_PROGRESSION_REASONS.find(
        (r) => r.code === selectedPredefinedReason
      );
      const noteParts: string[] = [];
      if (predefinedObj) noteParts.push(predefinedObj.label);
      if (statusActionNote.trim()) noteParts.push(statusActionNote.trim());
      const combinedNote = noteParts.join(" — ");

      const res = await fetch(`/api/requests/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          note: combinedNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update status");
      }
      setStatusActionNote("");
      setSelectedPredefinedReason("");
      setStatusFeedback(`Status changed to ${newStatus}`);
      setTimeout(() => setStatusFeedback(null), 3500);

      if (data.request) {
        setRequest((prev: any) => ({
          ...prev,
          ...data.request,
          followUps: data.request.followUps || prev?.followUps || [],
          attachments: data.request.attachments || prev?.attachments || [],
        }));
      }
      await fetchRequest(true);
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";

    setIsReopening(true);
    try {
      const res = await fetch(`/api/requests/${ticketId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reopenReason.trim(),
          token: effectiveToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reopen");
      }
      setShowReopenBox(false);
      setReopenReason("");
      alert("Ticket reopened and returned to IN PROGRESS!");
      if (data.request) {
        setRequest((prev: any) => ({
          ...prev,
          ...data.request,
          followUps: data.request.followUps || prev?.followUps || [],
          attachments: data.request.attachments || prev?.attachments || [],
        }));
      }
      fetchRequest(true);
    } catch (err: any) {
      alert(err.message || "Error reopening complaint.");
    } finally {
      setIsReopening(false);
    }
  };

  const handleEscalate = async () => {
    if (!confirm("Are you sure you want to escalate this complaint to the next senior engineer?")) {
      return;
    }

    setIsEscalating(true);
    try {
      const res = await fetch(`/api/requests/${ticketId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to escalate");
      }
      setEscalationSuccess(data.message);
      if (data.request) {
        setRequest((prev: any) => ({
          ...prev,
          ...data.request,
          followUps: data.request.followUps || prev?.followUps || [],
          attachments: data.request.attachments || prev?.attachments || [],
        }));
      }
      fetchRequest(true);
    } catch (err: any) {
      alert(err.message || "Escalation error.");
    } finally {
      setIsEscalating(false);
    }
  };

  // Handle Remove / Delete Request by Requester or Staff
  const handleDeleteRequest = async () => {
    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${ticketId}${effectiveToken ? `?token=${effectiveToken}` : ""}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete request");
      }
      // Remove from device storage
      removeTicketFromStorage(ticketId);
      setDeleteSuccess("Complaint request withdrawn and removed successfully.");
      setTimeout(() => {
        router.push("/track");
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Could not delete request.");
      setIsDeleting(false);
    }
  };

  const handleCopyTicket = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(ticketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    }
  };

  const handleToggleSharePhone = async () => {
    if (!request) return;
    const newShare = !request.sharePhoneWithStaff;
    setIsTogglingPhonePrivacy(true);
    const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";
    try {
      const res = await fetch(`/api/requests/${ticketId}${effectiveToken ? `?token=${effectiveToken}` : ""}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharePhoneWithStaff: newShare,
          token: effectiveToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequest((prev: any) => ({
          ...prev,
          sharePhoneWithStaff: newShare,
          canStaffCall: newShare && Boolean(prev.requesterPhone),
        }));
      }
    } catch (err) {
      console.error("Failed to toggle phone privacy", err);
    } finally {
      setIsTogglingPhonePrivacy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading complaint details...</p>
      </div>
    );
  }

  if (errorMsg || !request) {
    const isAuthChallenge = errorMsg?.includes("Access denied") || errorMsg?.includes("token");

    if (isAuthChallenge) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 text-slate-900 dark:text-white">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-indigo-100 dark:border-indigo-900/50">
              <Lock className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60">
                🔒 Privacy Protected Ticket
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Identity Verification Required
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Ticket <strong className="font-mono text-indigo-600 dark:text-indigo-400">{ticketId}</strong> is confidential. In accordance with IITGN resident privacy policy, only the registered complainant can view this request.
              </p>
            </div>

            {verificationError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center">
                <AlertTriangle className="w-4 h-4 text-rose-500 mr-2 shrink-0" />
                <span>{verificationError}</span>
              </div>
            )}

            {/* Verification Method Tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setVerificationMethod("dual")}
                className={`flex-1 py-2 rounded-lg transition-all ${verificationMethod === "dual"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
              >
                Email + Mobile Match
              </button>
              <button
                type="button"
                onClick={() => setVerificationMethod("token")}
                className={`flex-1 py-2 rounded-lg transition-all ${verificationMethod === "token"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
              >
                Secret Access Key
              </button>
            </div>

            <form onSubmit={handleVerifyIdentity} className="space-y-4">
              {verificationMethod === "dual" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Your Registered Email
                    </label>
                    <input
                      type="email"
                      required
                      value={verifyEmailInput}
                      onChange={(e) => setVerifyEmailInput(e.target.value)}
                      placeholder="e.g. resident@iitgn.ac.in"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Your Registered 10-Digit Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={verifyPhoneInput}
                      onChange={(e) => setVerifyPhoneInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 9876543210"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Both email and phone must match the record to prevent unauthorized access.
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Secret Access Token (from Submission receipt)
                  </label>
                  <input
                    type="text"
                    required
                    value={verifyTokenInput}
                    onChange={(e) => setVerifyTokenInput(e.target.value)}
                    placeholder="e.g. 041e0260c91c81f00b660deb..."
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center disabled:opacity-60 cursor-pointer"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-1.5" />
                )}
                <span>Verify & Unlock Ticket</span>
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href="/track"
                className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Return to Tracker Search
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Complaint Not Found</h2>
        <p className="text-sm text-slate-500">{errorMsg || "Ticket could not be retrieved."}</p>
        <div className="pt-2">
          <Link
            href="/track"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Tracker Search
          </Link>
        </div>
      </div>
    );
  }

  // Calculate current step index in status progression
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === request.status);
  const isReopened = request.status === "REOPENED";
  const effectiveToken = token || getTicketTokenFromStorage(ticketId) || "";
  const isAuthorizedViewer = Boolean(effectiveToken || currentUser);

  // Role checks for tailored technician and dispatch view
  const isTechnician =
    currentUser &&
    (currentUser.roleCode === "DEPT_STAFF" || currentUser.roleLevel === 3);
  const isAdmin =
    currentUser &&
    (currentUser.roleCode === "OVERALL_ADMIN" ||
      currentUser.roleCode === "DEPT_ADMIN" ||
      currentUser.roleLevel === 1 ||
      currentUser.roleLevel === 2);
  const isStaffOrAdmin = Boolean(isTechnician || isAdmin);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-8 space-y-4 sm:space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
        <Link
          href={isStaffOrAdmin ? "/admin" : "/track"}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {isTechnician
            ? "Back to Manage Tasks"
            : isAdmin
              ? "Back to Dispatch"
              : "Back to Search"}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchRequest()}
            className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </button>

          {/* Overall Admin Hard Delete OR Resident Mark Resolved */}
          {currentUser && (currentUser.roleCode === "OVERALL_ADMIN" || currentUser.roleLevel === 1) ? (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50/80 dark:bg-rose-950/60 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer shrink-0"
              title="Overall Administrator Permanent Deletion"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Delete Forever (Admin Only)</span>
            </button>
          ) : request.status !== "CLOSED" && request.status !== "RESOLVED" && !request.isArchived ? (
            <button
              onClick={handleConfirmFixed}
              className="inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Mark this issue as fixed and resolved"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
              <span>Mark Issue Resolved</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Technician & Staff Operations Console (Full-screen mobile control without modal cramping) */}
      {isStaffOrAdmin && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-900/60 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-white shrink-0 shadow-xs">
                {isTechnician ? <Wrench className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs sm:text-sm text-white">
                    {isTechnician ? "Technician Field Operations" : "Staff Dispatch & Control"}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {currentUser?.name || "Staff"}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-300">
                  {isTechnician
                    ? "Dedicated Work Order Console • Fast 1-tap updates, direct resident contact & field photos"
                    : "Department Maintenance Console • Full ticket control"}
                </p>
              </div>
            </div>

            {/* 1-Tap Quick Action Buttons (Email Default, Chat & Consent-gated Call) */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Default Institutional Channel: Email */}
              {request.requesterEmail && (
                <a
                  href={`mailto:${request.requesterEmail}?subject=IITGN Maintenance Ticket %23${request.ticketNumber} (${encodeURIComponent(request.domain || "Service")})`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  title={`Email resident at ${request.requesterEmail}`}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>Email ({request.requesterEmail.split("@")[0]})</span>
                </a>
              )}

              {/* In-App Live Chat */}
              <Link
                href={`/chat/${request.ticketNumber}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                title="Open full-screen chat with resident"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Open Chat</span>
              </Link>

              {/* Additional Phone Call (Consent Gated) */}
              {request.canStaffCall && request.requesterPhone ? (
                <a
                  href={`tel:${request.requesterPhone}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  title={`Call resident directly at ${request.requesterPhone}`}
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  <span>Call ({request.requesterPhone})</span>
                </a>
              ) : (
                <div
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 border border-white/15 text-slate-300 text-[11px] font-medium"
                  title={
                    request.sharePhoneWithStaff === false
                      ? "Resident chose to keep phone private. Coordinate via Email or In-app Chat."
                      : "Resident did not provide a phone number. Email & Chat are the active channels."
                  }
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{request.sharePhoneWithStaff === false ? "Phone Kept Private" : "Phone N/A"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Status Progression Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Quick Status Progression
              </span>
              {statusFeedback && (
                <span className="text-[11px] text-emerald-400 font-bold animate-pulse">
                  ✓ {statusFeedback}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {request.status !== "ACKNOWLEDGED" && request.status !== "IN_PROGRESS" && request.status !== "RESOLVED" && request.status !== "CLOSED" && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStaffUpdateStatus("ACKNOWLEDGED")}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-white/15 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Acknowledge</span>
                </button>
              )}

              {request.status !== "IN_PROGRESS" && request.status !== "RESOLVED" && request.status !== "CLOSED" && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStaffUpdateStatus("IN_PROGRESS")}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-white/15 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Work</span>
                </button>
              )}

              {request.status !== "RESOLVED" && request.status !== "CLOSED" && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStaffUpdateStatus("RESOLVED")}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-white/15 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>
              )}

              {(request.status === "CLOSED" || request.status === "RESOLVED") && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStaffUpdateStatus("IN_PROGRESS")}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-white/15 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen / Resume</span>
                </button>
              )}
            </div>

            {/* Predefined Progression Reason Options & Custom Note */}
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedPredefinedReason}
                  onChange={(e) => setSelectedPredefinedReason(e.target.value)}
                  className="w-full sm:w-1/2 text-xs px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 [&>option]:bg-slate-900 [&>option]:text-white font-medium"
                >
                  <option value="">-- Standard Progression Enum Option --</option>
                  {PREDEFINED_PROGRESSION_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={statusActionNote}
                  onChange={(e) => setStatusActionNote(e.target.value)}
                  placeholder="Additional custom note (optional)..."
                  className="w-full sm:w-1/2 text-xs px-3 py-2 rounded-xl bg-white/10 text-white placeholder:text-slate-400 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Quick clickable chips for 1-tap mobile operation */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {PREDEFINED_PROGRESSION_REASONS.slice(0, 4).map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() =>
                      setSelectedPredefinedReason(
                        selectedPredefinedReason === r.code ? "" : r.code
                      )
                    }
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      selectedPredefinedReason === r.code
                        ? "bg-white text-slate-900 border-white font-bold shadow-xs"
                        : "bg-white/5 hover:bg-white/15 text-slate-300 border-white/15"
                    }`}
                  >
                    {r.label.split("•")[0].trim()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Status Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 sm:space-y-5 text-slate-900 dark:text-white w-full min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 sm:pb-6 w-full min-w-0">
          <div className="space-y-2 min-w-0 w-full flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyTicket}
                title="Click to copy ticket number"
                className="inline-flex items-center space-x-1.5 font-mono text-lg sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 tracking-tight transition-colors"
              >
                <span className="break-all">{request.ticketNumber}</span>
                {copiedTicket ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </button>

              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${request.status === "RESOLVED" || request.status === "CLOSED"
                    ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                    : isReopened
                      ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                      : "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60"
                  }`}
              >
                {request.status}
              </span>

              {request.isUrgent && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  URGENT / EMERGENCY
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
              {request.subject}
            </h1>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
              Assigned Department:{" "}
              <strong className="text-slate-700 dark:text-slate-200">{request.department?.name}</strong> • Reported on{" "}
              {new Date(request.createdAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>

          {/* Right badges: Access Mode & Escalation Level */}
          <div className="w-full sm:w-auto flex flex-col sm:items-end gap-2 min-w-0">
            {currentUser ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-xs font-semibold shadow-2xs max-w-full flex-wrap">
                <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse shrink-0" />
                <span className="break-words">
                  Viewing as: <strong>{currentUser.roleName || currentUser.roleCode}</strong> ({currentUser.name})
                </span>
              </div>
            ) : effectiveToken ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold shadow-2xs max-w-full flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="break-words">
                  Verified Resident Requester ({request.requesterName})
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-2xs max-w-full flex-wrap">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="break-words">Viewing as: <strong>Guest (Read-Only)</strong></span>
              </div>
            )}

            {/* Escalation Level Badge */}
            {request.escalationLevel > 0 && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs text-left sm:text-right w-full sm:w-auto max-w-full min-w-0">
                <div className="flex items-center sm:justify-end space-x-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Escalated to Tier {request.escalationLevel}</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 break-words">
                  {request.escalationNote || "Escalated for senior review."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status Stepper Progression - Responsive on Desktop & Mobile */}
        <div className="py-2">
          {/* Mobile view: clear stage progress bar & current pill */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                Progress Stage {Math.max(1, currentStepIndex + 1)} of {STATUS_STEPS.length}
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/60">
                {request.status}
              </span>
            </div>

            {/* Mobile Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(15, Math.round(((currentStepIndex + 1) / STATUS_STEPS.length) * 100)))}%`,
                }}
              />
            </div>

            {/* Scrollable Stage Pills on Mobile */}
            <div className="flex overflow-x-auto gap-2 py-1 scrollbar-none text-[11px]">
              {STATUS_STEPS.map((step, idx) => {
                const isPast = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;
                return (
                  <div
                    key={step.key}
                    className={`shrink-0 px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1 border ${isCurrent
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs"
                        : isPast
                          ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
                      }`}
                  >
                    {isPast && <CheckCircle2 className="w-3 h-3" />}
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop view: 6-step connected stepper */}
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Repair Lifecycle Progress
            </p>

            <div className="grid grid-cols-6 gap-0 relative">
              {STATUS_STEPS.map((step, idx) => {
                const isPast = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center relative">
                    {/* Connecting line */}
                    {idx < STATUS_STEPS.length - 1 && (
                      <div
                        className={`absolute top-3.5 left-1/2 w-full h-1 -z-0 transition-colors ${currentStepIndex > idx ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                          }`}
                      />
                    )}

                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all ${isPast
                          ? "bg-emerald-600 text-white shadow-xs shadow-emerald-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                        }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <span
                      className={`text-[11px] mt-2 font-medium ${isCurrent
                          ? "text-indigo-600 dark:text-indigo-400 font-bold"
                          : isPast
                            ? "text-slate-800 dark:text-slate-200"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Banner for Resolved Tickets (Confirm Fixed vs Reopen) */}
        {request.status === "RESOLVED" && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>The technician has marked this complaint as RESOLVED!</span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300/90">
              Please verify if the issue at your room/apartment is solved properly.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleConfirmFixed}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Yes, Problem is Fixed (Close Ticket)
              </button>
              <button
                type="button"
                onClick={() => setShowReopenBox(!showReopenBox)}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                No, Problem Persists (Reopen)
              </button>
            </div>

            {showReopenBox && (
              <form onSubmit={handleReopen} className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/60 space-y-3">
                <label className="block text-xs font-semibold text-rose-900 dark:text-rose-300">
                  State the reason why the problem is not resolved:
                </label>
                <textarea
                  required
                  rows={2}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. The fan was fixed but now makes loud screeching noise..."
                  className="w-full text-xs p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={isReopening}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {isReopening ? "Reopening..." : "Submit Reopen Notice"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Secondary Archival Storage Notice */}
        {request.isArchived && (
          <div className="bg-slate-900 text-white border border-slate-700 rounded-2xl p-5 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
              <Archive className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>Transferred to Secondary Archival Storage</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This maintenance request exceeded its active grace period and has been archived into secondary storage. Under campus facility data lifecycle rules, records in secondary storage are preserved for 180 days before permanent automated deletion{request.purgeDueAt ? ` (scheduled purge: ${new Date(request.purgeDueAt).toLocaleDateString()})` : ""}. Reopening and further replies are disabled.
            </p>
          </div>
        )}

        {/* Closed Ticket Grace Window Banner */}
        {request.status === "CLOSED" && !request.isArchived && (
          <div
            className={`border rounded-2xl p-4 sm:p-5 space-y-3 ${request.canReopen
                ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60"
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Clock className={`w-5 h-5 shrink-0 ${request.canReopen ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`} />
                <span className={`font-bold text-sm ${request.canReopen ? "text-amber-900 dark:text-amber-200" : "text-slate-700 dark:text-slate-200"}`}>
                  {request.canReopen
                    ? "Complaint Closed • Reopen Window Active"
                    : "Complaint Closed • Reopen Grace Window Concluded"}
                </span>
              </div>
              {request.canReopen && request.reopenDeadline && (() => {
                const countdown = formatReopenRemaining(request.reopenDeadline, nowTime);
                if (countdown.isExpired) return null;
                return (
                  <div className="flex flex-col items-start sm:items-end bg-amber-100/90 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-xl shadow-2xs shrink-0">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-950 dark:text-amber-100">
                      <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                      <span>{countdown.remainingText}</span>
                    </div>
                    <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                      {countdown.endDateText}
                    </span>
                  </div>
                );
              })()}
            </div>

            <p className={`text-xs ${request.canReopen ? "text-amber-800 dark:text-amber-300/90" : "text-slate-500 dark:text-slate-400"}`}>
              {request.canReopen ? (
                <>
                  This ticket was marked closed by {request.closedByRole === "requester" ? "you" : "the maintenance department"}.
                  You have a <strong>3-day</strong> cooldown grace window. If the issue is not fixed, you can reopen it below or post a reply in Follow-up Notes to automatically return it to <strong>IN PROGRESS</strong>. Once this 3-day cooldown elapses without activity, the ticket will transfer to secondary storage.
                </>
              ) : (
                <>
                  The grace period to reopen this ticket has concluded. This complaint has been transferred to secondary storage. If you need any further assistance, please submit a new maintenance request.
                </>
              )}
            </p>

            {request.canReopen && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowReopenBox(!showReopenBox)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  Reopen This Complaint
                </button>
              </div>
            )}

            {showReopenBox && (
              <form onSubmit={handleReopen} className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/60 space-y-3">
                <label className="block text-xs font-semibold text-rose-900 dark:text-rose-300">
                  Reason for reopening:
                </label>
                <textarea
                  required
                  rows={2}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe why this maintenance complaint needs further action..."
                  className="w-full text-xs p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={isReopening}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {isReopening ? "Reopening..." : "Confirm Reopen"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Grid: Details & Assigned Staff vs Communication Thread & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full min-w-0">
        {/* Left Column: Staff Info & Complaint Details (Positions 2 & 3) */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6 w-full min-w-0 order-1 lg:order-1">
          {/* 2nd Position: Assigned Field Staff Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-slate-900 dark:text-white w-full min-w-0 overflow-hidden">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Assigned Field Staff
            </h3>

            {request.assignedStaff ? (
              <div className="p-3 sm:p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl sm:rounded-2xl border border-indigo-100 dark:border-indigo-900/60 space-y-2.5 w-full min-w-0">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-xs shrink-0">
                    {request.assignedStaff.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {request.assignedStaff.name}
                    </p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium truncate">Department Technician</p>
                  </div>
                </div>

                {request.assignedStaff.phone && (
                  <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center font-medium">
                      <Phone className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span>{request.assignedStaff.phone}</span>
                    </span>
                    <a
                      href={`tel:${request.assignedStaff.phone}`}
                      className="inline-flex items-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs shrink-0"
                    >
                      Call Technician
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                Assignment in progress by {request.department?.name || "Department"} Supervisor.
              </div>
            )}
          </div>

          {/* 3rd Position: Fault Specifications Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 text-slate-900 dark:text-white w-full min-w-0 overflow-hidden">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Fault Specifications
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="min-w-0">
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">Location</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-start sm:items-center mt-0.5 break-words">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-500 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">{request.locationDetail}</span>
                </span>
                {request.corridor && (
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] ml-4 mt-0.5 break-words">
                    Corridor: {request.corridor}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">Domain & Subcategory</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold block mt-0.5 break-words">
                  {request.domain} → {request.subDomain1}
                  {request.subDomain2 ? ` (${request.subDomain2})` : ""}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">Preferred Availability</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-start sm:items-center mt-0.5 break-words">
                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">{request.availability}</span>
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">Description</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 whitespace-pre-wrap break-words">
                  {request.description}
                </p>
              </div>
            </div>

            {/* Attached Photos Gallery (2 rows max, 3rd row overflow blurred with +X) */}
            {request.attachments && request.attachments.length > 0 && (
              <EvidencePhotosGallery
                attachments={request.attachments}
                title="Evidence Photos"
                onSelectImage={(idx) =>
                  openLightbox(
                    request.attachments.map((att: any) => ({
                      url: att.url,
                      name: att.originalName || att.name || "Evidence Photo",
                      sizeBytes: att.sizeBytes,
                    })),
                    idx
                  )
                }
              />
            )}
          </div>

          {/* 4th Position: Resident Requester & Contact Privacy Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 text-slate-900 dark:text-white w-full min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Resident & Contact Privacy
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                IITGN ID
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">Resident Requester</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold block mt-0.5">
                  {request.requesterName}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium text-[11px]">
                  Institutional Email (Primary • Default)
                </span>
                <a
                  href={`mailto:${request.requesterEmail}`}
                  className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline mt-0.5 break-all"
                  title="Send email to resident"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{request.requesterEmail}</span>
                </a>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px]">
                    Mobile Phone (Optional Coordination)
                  </span>
                </div>

                {isStaffOrAdmin ? (
                  // Technician / Staff perspective
                  request.canStaffCall && request.requesterPhone ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                        {request.requesterPhone}
                      </span>
                      <a
                        href={`tel:${request.requesterPhone}`}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        Call
                      </a>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-[11px]">
                        {request.sharePhoneWithStaff === false
                          ? "Phone kept private by resident preference (coordinate via email/chat)."
                          : "No phone number provided by resident (coordinate via email/chat)."}
                      </span>
                    </div>
                  )
                ) : (
                  // Resident perspective
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {request.requesterPhone || "No phone added"}
                      </span>
                      <Link
                        href="/profile"
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Profile Settings →
                      </Link>
                    </div>

                    {request.requesterPhone ? (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <label htmlFor="toggleSharePhone" className="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                          Share number with assigned technician
                        </label>
                        <input
                          id="toggleSharePhone"
                          type="checkbox"
                          disabled={isTogglingPhonePrivacy}
                          checked={request.sharePhoneWithStaff ?? true}
                          onChange={handleToggleSharePhone}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Technicians coordinate via your institutional email. You can register a phone number in your profile.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Communication Thread & Timeline (4th Position: Follow-up Notes) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 w-full min-w-0 order-2 lg:order-2">
          {/* 4th Position: Conversation Thread - Follow-up Notes & Updates */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 text-slate-900 dark:text-white w-full min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                      Follow-up Notes & Updates
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {request.followUps?.length || 0} msgs
                    </span>
                    {firstUnreadId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse shrink-0">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    Direct communication with maintenance staff
                  </p>
                </div>
              </div>

              {/* Integrated compact Full Chat button right in header (eliminating large banner space wastage) */}
              <Link
                href={`/chat/${request.ticketNumber}${effectiveToken ? `?token=${effectiveToken}` : ""}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Open Dedicated Full Chat View"
              >
                <span>Full Chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Chat Message List: Chronological (Oldest top, Newest bottom) with Default Bottom Scroll */}
            <div
              ref={followUpContainerRef}
              className="space-y-3 max-h-[360px] sm:max-h-[420px] overflow-y-auto px-1 py-1 scrollbar-thin"
            >
              {request.followUps?.length === 0 ? (
                <div className="py-7 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-1 p-3">
                  <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No updates or notes yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                    You can post notes, request visit timing, or attach repair photos here.
                  </p>
                </div>
              ) : (
                [...(request.followUps || [])]
                  .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((msg: any) => {
                    const isStaff = msg.authorRole !== "requester";
                    const isStaffOrAdmin =
                      currentUser &&
                      (currentUser.roleCode === "OVERALL_ADMIN" ||
                        currentUser.roleCode === "DEPT_ADMIN" ||
                        currentUser.roleCode === "DEPT_STAFF");
                    const isMe = currentUser
                      ? isStaffOrAdmin
                        ? msg.authorRole === "staff" || msg.authorRole === "admin"
                        : msg.authorRole === "requester" || msg.authorRole === "resident"
                      : msg.authorRole === "requester";
                    const parsed = parseCommentContent(msg.message);

                    return (
                      <div key={msg.id} className="space-y-2">
                        {/* Unread Messages Separator (New Messages Below) */}
                        {firstUnreadId === msg.id && (
                          <div className="relative my-2.5 flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-indigo-300 dark:border-indigo-700" />
                            </div>
                            <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-xs uppercase tracking-wider animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>New Messages Below</span>
                            </div>
                          </div>
                        )}

                        {/* Chat-style Bubble: Outgoing (Me) on Right in Indigo, Incoming on Left in Slate */}
                        <div className={`flex ${isMe ? "justify-end" : "justify-start"} transition-all`}>
                          <div
                            className={`relative p-3 rounded-2xl shadow-2xs max-w-[88%] sm:max-w-[76%] space-y-1.5 text-xs ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-tr-xs border border-indigo-500"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700"
                            }`}
                          >
                            {/* Sender Header for Counterparty Only (no 'You' for own messages) */}
                            {!isMe && (
                              <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {msg.authorName}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isStaff
                                      ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300"
                                      : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                                  }`}
                                >
                                  {isStaff ? "IITGN Staff" : "Requester"}
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
                                {parsed.images.map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => openLightbox(parsed.images, i)}
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

            {/* Post Follow-up Box */}
            {request.isArchived || (request.status === "CLOSED" && !request.canReopen) ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
                This complaint is closed and past the reopen window. Further replies are disabled. Please submit a new maintenance request if needed.
              </div>
            ) : isAuthorizedViewer ? (
              <form onSubmit={handlePostComment} className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>
                      Reply as{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {currentUser ? currentUser.name : request.requesterName}
                      </strong>
                    </span>
                  </span>

                  {(request.status === "RESOLVED" || request.status === "CLOSED") && (
                    <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 break-words">
                      ⚡ Replying moves complaint back to IN PROGRESS
                    </span>
                  )}
                </div>

                {/* Textarea for note */}
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    request.status === "RESOLVED" || request.status === "CLOSED"
                      ? "Type a reply to automatically reopen this ticket to In Progress..."
                      : "Type an update for the technician (e.g. In room right now, replaced parts, etc.)..."
                  }
                  className="w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs font-medium"
                />

                {/* Attached Photo Thumbnails Preview */}
                {attachedPhotos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {attachedPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 w-16 h-16 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-2xs"
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white shadow-xs cursor-pointer z-10"
                          title="Remove photo"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnotatingAttachedPhotoIdx(idx)}
                          className="absolute bottom-0 inset-x-0 py-0.5 bg-slate-900/90 hover:bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs z-10 transition-colors"
                          title="Edit or draw markings on this photo"
                        >
                          <Pen className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ))}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {attachedPhotos.length}/3 photos
                    </span>
                  </div>
                )}

                {/* Toolbar: Attach Photo + Submit Button */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {currentUser ? (
                    <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white font-semibold text-xs cursor-pointer transition-colors">
                      <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Attach Photo ({attachedPhotos.length}/3)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium text-xs">
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Guest Mode: Photos disabled (Sign in to attach)</span>
                    </span>
                  )}

                  <button
                    type="submit"
                    disabled={isPostingComment || (!commentText.trim() && attachedPhotos.length === 0)}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isPostingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send Update</span>
                        <Send className="w-3.5 h-3.5 ml-1.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Tracking as Guest (Read-Only)
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      To send updates or attach repair photos, sign in with your IITGN account or unlock with your registered phone number.
                    </p>
                  </div>
                  <Link
                    href={`/login?redirect=/track/${ticketId}`}
                    className="shrink-0 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs text-center transition-colors shadow-xs"
                  >
                    Sign In to Reply & Attach Photos
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Official Status Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 text-slate-900 dark:text-white">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Official Status Timeline
            </h3>

            <div className="relative pl-6 border-l-2 border-indigo-200 dark:border-indigo-900 space-y-6 my-2">
              {request.statusEvents?.map((event: any) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 shadow-xs"></div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {event.eventType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(event.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{event.note}</p>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      By {event.performedByName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Department-Specific 3-Level Escalation Ladder */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl border border-slate-800 space-y-5 sm:space-y-6 w-full min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4 w-full min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="inline-flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider flex-wrap">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="break-words">Complaint Redressal Mechanism • {request.department?.name}</span>
            </div>
            <h2 className="text-base sm:text-2xl font-bold tracking-tight text-white mt-1 break-words">
              Automated 3-Tier Escalation Hierarchy
            </h2>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed break-words">
              If delayed or unresolved, the system supports automatic and manual escalation to senior engineers and department heads.
            </p>
          </div>

          {/* Current Escalation Status Badge & Trigger */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${request.escalationLevel === 0
                ? "bg-slate-800 text-slate-300 border-slate-700"
                : request.escalationLevel === 1
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : request.escalationLevel === 2
                    ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              }`}>
              {request.escalationLevel === 0
                ? "Tier: Standard Queue"
                : `Active: Tier ${request.escalationLevel}`}
            </span>

            {(() => {
              const isStaffOrAdminViewer = Boolean(
                currentUser &&
                (currentUser.roleLevel <= 3 ||
                  currentUser.roleCode === "OVERALL_ADMIN" ||
                  currentUser.roleCode === "DEPT_ADMIN" ||
                  currentUser.roleCode === "DEPT_STAFF")
              );

              const isResolvedVerificationActive = Boolean(
                request.status === "RESOLVED" &&
                (() => {
                  const refTime = request.resolvedAt || request.updatedAt;
                  if (!refTime) return true;
                  return Date.now() - new Date(refTime).getTime() <= 3 * 24 * 60 * 60 * 1000;
                })()
              );

              const canEscalateNow =
                request.escalationLevel < 3 &&
                request.status !== "CLOSED" &&
                !request.isArchived &&
                (isStaffOrAdminViewer || isResolvedVerificationActive);

              if (canEscalateNow) {
                return (
                  <button
                    type="button"
                    onClick={handleEscalate}
                    disabled={isEscalating}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isEscalating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Escalating...</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          {isStaffOrAdminViewer
                            ? `Staff Escalation: Tier ${request.escalationLevel + 1}`
                            : `Issue Persists? Escalate to Tier ${request.escalationLevel + 1}`}
                        </span>
                      </>
                    )}
                  </button>
                );
              }

              if (request.status !== "RESOLVED" && request.status !== "CLOSED" && !isStaffOrAdminViewer) {
                return (
                  <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700 font-medium">
                    Attending by department technician
                  </span>
                );
              }

              return null;
            })()}
          </div>
        </div>

        {escalationSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
            <span>{escalationSuccess}</span>
          </div>
        )}

        {/* 3 Tiers Grid tailored to this specific department */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          {/* Tier 1 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all w-full min-w-0 overflow-hidden ${request.escalationLevel === 1
              ? "bg-amber-500/15 border-amber-400/50 shadow-md ring-1 ring-amber-400/30"
              : "bg-white/5 border-white/10"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Tier 1
              </span>
              <span className="text-[11px] text-slate-400 flex items-center">
                <Clock className="w-3 h-3 mr-1 text-slate-400" />
                After {request.department?.slaHoursL1 || 24} hrs
              </span>
            </div>
            <h4 className="font-bold text-sm text-white">
              Assistant Executive Engineer (AEE)
            </h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Operational department oversight for {request.department?.name}.
            </p>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] min-w-0">
              <span className="text-slate-400 block">Department Lead Officer:</span>
              <span className="font-mono text-indigo-300 font-medium block truncate mt-0.5">
                {request.department?.leadEmail || "aee1.electrical@iitgn.ac.in"}
              </span>
              {request.department?.leadPhone && (
                <span className="text-slate-300 block text-[10px] mt-0.5">
                  Direct Ext: {request.department.leadPhone}
                </span>
              )}
            </div>
          </div>

          {/* Tier 2 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all w-full min-w-0 overflow-hidden ${request.escalationLevel === 2
              ? "bg-orange-500/15 border-orange-400/50 shadow-md ring-1 ring-orange-400/30"
              : "bg-white/5 border-white/10"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Tier 2
              </span>
              <span className="text-[11px] text-slate-400 flex items-center">
                <Clock className="w-3 h-3 mr-1 text-slate-400" />
                After {request.department?.slaHoursL2 || 72} hrs
              </span>
            </div>
            <h4 className="font-bold text-sm text-white">
              Executive Engineer (EE)
            </h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Institute Works division head. Intervenes on delayed repairs and coordination.
            </p>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] min-w-0">
              <span className="text-slate-400 block">Divisional Office:</span>
              <span className="font-mono text-indigo-300 font-medium block truncate mt-0.5">
                ee.civil@iitgn.ac.in
              </span>
            </div>
          </div>

          {/* Tier 3 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all w-full min-w-0 overflow-hidden ${request.escalationLevel >= 3
              ? "bg-rose-500/15 border-rose-400/50 shadow-md ring-1 ring-rose-400/30"
              : "bg-white/5 border-white/10"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Tier 3
              </span>
              <span className="text-[11px] text-slate-400 flex items-center">
                <Clock className="w-3 h-3 mr-1 text-slate-400" />
                After {request.department?.slaHoursL3 || 168} hrs
              </span>
            </div>
            <h4 className="font-bold text-sm text-white">
              Superintending Engineer (SE)
            </h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Apex Institute Works authority for unresolved grievances.
            </p>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] min-w-0">
              <span className="text-slate-400 block">Apex Authority Email:</span>
              <span className="font-mono text-indigo-300 font-medium block truncate mt-0.5">
                se@iitgn.ac.in
              </span>
            </div>
          </div>
        </div>

        {/* Emergency contact footnote */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 w-full min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="break-words">For emergency hazards (active fire, pipe burst, sparking), call 24x7 Works Control Room:</span>
          </div>
          <span className="font-bold text-amber-300 shrink-0">
            Control Room: +91-79-2395-2000
          </span>
        </div>
      </div>

      {/* OVERALL ADMIN HARD DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[99998] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/40">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                Overall Administrator Authority
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Permanently Delete Complaint?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As Overall Administrator, this is your final call: complaint <strong className="font-mono text-indigo-600 dark:text-indigo-400">{request.ticketNumber}</strong> will be <strong>deleted forever from the database</strong>, along with all attached files, comments, and audit history. This action is irreversible.
              </p>
            </div>

            {deleteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold text-center border border-emerald-200">
                {deleteSuccess}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteRequest}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
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

      {/* FULLSCREEN LIGHTBOX MODAL WITH ZOOM, PAN, ANNOTATION, DIRECT REPLY & BACK-BUTTON SUPPORT */}
      {lightboxGallery && (
        <ImageLightboxModal
          images={lightboxGallery.images}
          initialIndex={lightboxGallery.initialIndex}
          onClose={() => setLightboxGallery(null)}
          onDirectReply={handleDirectReplyFromPhoto}
        />
      )}

      {/* Modal for annotating attached photos before sending */}
      {annotatingAttachedPhotoIdx !== null && attachedPhotos[annotatingAttachedPhotoIdx] && (
        <ImageLightboxModal
          images={[
            {
              url: attachedPhotos[annotatingAttachedPhotoIdx].url,
              name: attachedPhotos[annotatingAttachedPhotoIdx].name || "Attached Photo",
            },
          ]}
          startInDrawMode={true}
          onClose={() => setAnnotatingAttachedPhotoIdx(null)}
          onSaveAnnotation={(annotatedUrl) => {
            setAttachedPhotos((prev) =>
              prev.map((item, i) =>
                i === annotatingAttachedPhotoIdx ? { ...item, url: annotatedUrl } : item
              )
            );
            setAnnotatingAttachedPhotoIdx(null);
          }}
        />
      )}

      {/* Mobile Floating Action Button for Live Chat */}
      <div className="fixed bottom-5 right-4 z-40 sm:hidden">
        <Link
          href={`/chat/${request.ticketNumber}${effectiveToken ? `?token=${effectiveToken}` : ""}`}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 active:bg-indigo-700 text-white font-bold rounded-full shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-xs font-bold">Open Chat</span>
          {(request.followUps?.length || 0) > 0 && (
            <span className="bg-white text-indigo-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {request.followUps.length}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

export default function SingleTicketTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading ticket tracking details...</p>
        </div>
      }
    >
      <SingleTicketTrackContent />
    </Suspense>
  );
}
