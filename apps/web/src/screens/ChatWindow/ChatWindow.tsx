import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { useMessageStore } from "../../store/message.store";
import ChatHeader from "./ChatHeader";
import MessageBubble from "../../components/Message/MessageBubble";
import type { Message } from "../../../../../packages/shared-types/message";
import { getUserIdFromToken } from "../../utils/jwt";
import MessageInput from "./MessageInput";
import { getSocket } from "../../services/socket.service";
import { MessageStatus } from "../../../../../packages/shared-types/message";
import {
  deleteMessages as deleteMessagesFromDB,
  getLatestPinnedMessageByChat,
  getMessageById,
  getMessagesByIds,
  getMessagesByChatPage,
  patchMessage as patchMessageInDB,
  updateMessageStatus,
} from "../../db/message.repo";
import { normalizeChat } from "../../utils/normalizeChat";
import { runSyncCycle, seedLastSyncedAtFromChat } from "../../services/sync.service";
import { joinChat, onTypingUpdate, offTypingUpdate } from "../../services/socket.service";
import {
  deleteMessagesForEveryoneOnServer,
  deleteMessagesForMeOnServer,
  pinMessageOnServer,
} from "../../services/message.service";

const CHAT_TIMEZONE = "Asia/Kolkata";

const getDateGroupKey = (timestamp: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));

const formatDateDivider = (timestamp: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: CHAT_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));

const TypingDots = () => {
  const dotStyle = (delay: string) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#667781",
    animation: `typingBounce 1.4s ${delay} infinite ease-in-out`,
  });

  return (
    <>
      <style>
        {`
          @keyframes typingBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
        `}
      </style>
      <div style={{ display: "flex", gap: 6, backgroundColor: "transparent", alignItems: "center" }}>
        <span style={dotStyle("0s")} />
        <span style={dotStyle("0.2s")} />
        <span style={dotStyle("0.4s")} />
      </div>
    </>
  );
};

export default function ChatWindow() {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const pendingDeleteChat = useChatStore((s) => s.pendingDeleteChat);
  const cancelDeleteChatRequest = useChatStore((s) => s.cancelDeleteChatRequest);
  const deleteChatForMe = useChatStore((s) => s.deleteChatForMe);
  const token = useAuthStore((s) => s.token);
  const isUserAtBottomRef = useRef(true);
  const PAGE_SIZE = 50;

  const activeChat = useMemo(() => {
    return activeChatRaw ? normalizeChat(activeChatRaw) : null;
  }, [activeChatRaw]);

  const myUserId = useMemo(() => {
    return token ? getUserIdFromToken(token) : null;
  }, [token]);

  const {
    messages: allMessages,
    addMessage,
    updateStatus,
    removeMessages,
    removeChatMessages,
    patchMessage,
  } =
    useMessageStore();

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestLoadedRef = useRef<number | null>(null);
  const loadingReferenceIdsRef = useRef<Set<string>>(new Set());
  const suppressNextAutoScrollRef = useRef(false);
  const allowLoadOlderRef = useRef(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [fallbackPinnedMessage, setFallbackPinnedMessage] = useState<Message | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const dragSelectingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragLastKeyRef = useRef<string | null>(null);
  const suppressSelectionClickRef = useRef(false);
  const isLeftMouseDownRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getSelectionKey = (m: Message) =>
    m.clientId ?? m.id ?? `${m.chatId}:${m.senderId}:${m.createdAt}`;

  const enterSelectionMode = (msg: Message) => {
    const key = getSelectionKey(msg);
    setSelectionMode(true);
    setSelectedIds(new Set([key]));
  };

  const toggleSelection = (msg: Message) => {
    const key = getSelectionKey(msg);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const applySelectionDuringDrag = (msg: Message) => {
    const key = getSelectionKey(msg);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const handleSelectionDragStart = (e: ReactMouseEvent<HTMLDivElement>, msg: Message) => {
    if (e.button !== 0) return;
    if (!selectionMode) return;
    const key = getSelectionKey(msg);
    if (!selectedIds.has(key)) {
      applySelectionDuringDrag(msg);
      suppressSelectionClickRef.current = true;
    }

    dragSelectingRef.current = true;
    dragMovedRef.current = false;
    dragLastKeyRef.current = key;
  };

  const handleSelectionDragEnter = (e: ReactMouseEvent<HTMLDivElement>, msg: Message) => {
    if (!selectionMode) return;
    if (!dragSelectingRef.current) return;
    if ((e.buttons & 1) !== 1) return;
    const key = getSelectionKey(msg);
    if (dragLastKeyRef.current === key) return;
    dragMovedRef.current = true;
    applySelectionDuringDrag(msg);
    dragLastKeyRef.current = key;
  };

  const shouldSuppressSelectionClick = () => {
    if (!suppressSelectionClickRef.current) return false;
    suppressSelectionClickRef.current = false;
    return true;
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setDeleteTargetIds(null);
  };

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (e.button === 0) {
        isLeftMouseDownRef.current = true;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      isLeftMouseDownRef.current = false;
      if (dragMovedRef.current) suppressSelectionClickRef.current = true;
      dragSelectingRef.current = false;
      dragMovedRef.current = false;
      dragLastKeyRef.current = null;
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setReplyToMessage(null);
    setEditTarget(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchActiveIndex(0);
    setDeleteDialogOpen(false);
    setDeleteTargetIds(null);
    setContextMenu(null);
    setFallbackPinnedMessage(null);
    loadingReferenceIdsRef.current = new Set();
  }, [activeChat?.id]);

  useEffect(() => {
    if (!activeChat || !myUserId) return;
    const leaveChat = joinChat(activeChat.id);

    const handleTyping = ({
      chatId,
      userId,
      typing,
    }: {
      chatId: string;
      userId: string;
      typing: boolean;
    }) => {
      if (userId === myUserId) return;
      if (chatId !== activeChat.id) return;
      setIsTyping(typing);
    };

    onTypingUpdate(handleTyping);
    return () => {
      leaveChat();
      offTypingUpdate(handleTyping);
      setIsTyping(false);
    };
  }, [activeChat?.id, myUserId]);

  useEffect(() => {
    if (!activeChat) return;
    (async () => {
      await seedLastSyncedAtFromChat(activeChat.id, activeChat.lastMessage?.createdAt);

      const cachedMessages = await getMessagesByChatPage(activeChat.id, { limit: PAGE_SIZE });
      if (cachedMessages.length) {
        const newestCached = Math.max(
          ...cachedMessages.map((m) => Number(m.createdAt)).filter((t) => Number.isFinite(t))
        );
        if (Number.isFinite(newestCached)) {
          await seedLastSyncedAtFromChat(activeChat.id, newestCached);
        }
      }

      const existingKeys = new Set(allMessages.flatMap((m) => [m.id, m.clientId].filter(Boolean)));
      cachedMessages.forEach((m) => {
        if (!existingKeys.has(m.id) && !existingKeys.has(m.clientId)) {
          addMessage(m);
        }
      });

      if (cachedMessages.length) {
        oldestLoadedRef.current = Math.min(...cachedMessages.map((m) => m.createdAt));
      } else {
        oldestLoadedRef.current = null;
      }

      setHasMore(cachedMessages.length === PAGE_SIZE);

      allowLoadOlderRef.current = false;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        allowLoadOlderRef.current = true;
      });

      await runSyncCycle();
    })();
  }, [activeChat, addMessage]);

  const messages = useMemo(() => {
    if (!activeChat) return [];
    return allMessages
      .filter((m: Message) => m.chatId === activeChat.id)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allMessages, activeChat]);

  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach((m) => {
      map.set(m.id, m);
      if (m.clientId) map.set(m.clientId, m);
    });
    return map;
  }, [messages]);

  const messagesBySelectionKey = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach((m) => {
      map.set(getSelectionKey(m), m);
    });
    return map;
  }, [messages]);

  const selectedMessages = useMemo(() => {
    const ids = selectedIds;
    return messages.filter((m) => ids.has(getSelectionKey(m)));
  }, [messages, selectedIds]);

  const searchMatchedMessageIds = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return [];

    return messages
      .filter((m) => !m.deleted && Boolean(m.text?.toLowerCase().includes(needle)))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  const deleteCandidates = useMemo(() => {
    if (!deleteTargetIds?.length) return selectedMessages;
    const idSet = new Set(deleteTargetIds);
    return messages.filter((m) => idSet.has(m.id));
  }, [messages, selectedMessages, deleteTargetIds]);

  const singleSelectedMessage = selectedMessages.length === 1 ? selectedMessages[0] : null;
  const canDeleteForEveryone =
    deleteCandidates.length > 0 && deleteCandidates.every((m) => m.senderId === myUserId);
  const canCopyMessage = (m: Message) => !m.deleted && Boolean(m.text?.trim());
  const canReplyMessage = (m: Message) => !m.deleted;
  const canEditMessage = (m: Message) =>
    m.senderId === myUserId && !m.deleted && Boolean(m.text?.trim());
  const canPinMessage = (m: Message) => !m.deleted;
  const canDeleteMessage = (m: Message) => Boolean(m.id);

  const canCopySelected = selectedMessages.some(canCopyMessage);
  const canReplySelected = Boolean(singleSelectedMessage && canReplyMessage(singleSelectedMessage));
  const canEditSelected = Boolean(singleSelectedMessage && canEditMessage(singleSelectedMessage));
  const canPinSelected = Boolean(singleSelectedMessage && canPinMessage(singleSelectedMessage));
  const canDeleteSelected = selectedMessages.some(canDeleteMessage);

  const pinnedMessage = useMemo(() => {
    const pinned = messages.filter((m) => m.pinned);
    if (!pinned.length) return null;
    return pinned.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))[0];
  }, [messages]);
  const displayedPinnedMessage = pinnedMessage ?? fallbackPinnedMessage;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeChat) return;

    const missingReplyIds = Array.from(
      new Set(
        messages
          .map((m) => m.replyTo)
          .filter((replyId): replyId is string => Boolean(replyId))
          .filter(
            (replyId) =>
              !messagesById.has(replyId) &&
              !loadingReferenceIdsRef.current.has(replyId)
          )
      )
    );

    if (!missingReplyIds.length) return;
    missingReplyIds.forEach((id) => loadingReferenceIdsRef.current.add(id));

    let cancelled = false;
    void (async () => {
      try {
        const referenced = await getMessagesByIds(missingReplyIds);
        if (cancelled) return;
        referenced
          .filter((m) => m.chatId === activeChat.id)
          .forEach((m) => addMessage(m));
      } finally {
        missingReplyIds.forEach((id) => loadingReferenceIdsRef.current.delete(id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChat, addMessage, messages, messagesById]);

  useEffect(() => {
    if (!activeChat) return;
    if (pinnedMessage) {
      setFallbackPinnedMessage(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const fromDb = await getLatestPinnedMessageByChat(activeChat.id);
      if (cancelled) return;
      if (fromDb) {
        setFallbackPinnedMessage(fromDb);
        addMessage(fromDb);
      } else {
        setFallbackPinnedMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChat, addMessage, pinnedMessage]);

  useEffect(() => {
    if (suppressNextAutoScrollRef.current) {
      suppressNextAutoScrollRef.current = false;
      return;
    }
    if (isUserAtBottomRef.current && !isLoadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoadingOlder]);

  const loadOlderMessages = async () => {
    if (!activeChat || isLoadingOlder || !hasMore) return;
    setIsLoadingOlder(true);
    isUserAtBottomRef.current = false;
    suppressNextAutoScrollRef.current = true;

    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    const before = oldestLoadedRef.current ?? Number.MAX_SAFE_INTEGER;
    const older = await getMessagesByChatPage(activeChat.id, {
      limit: PAGE_SIZE,
      before,
    });

    if (older.length) {
      const existingKeys = new Set(allMessages.flatMap((m) => [m.id, m.clientId].filter(Boolean)));
      older.forEach((m) => {
        if (!existingKeys.has(m.id) && !existingKeys.has(m.clientId)) {
          addMessage(m);
        }
      });
      oldestLoadedRef.current = Math.min(before, ...older.map((m) => m.createdAt));
    }

    setHasMore(older.length === PAGE_SIZE);
    setIsLoadingOlder(false);

    requestAnimationFrame(() => {
      if (!container) return;
      const newScrollHeight = container.scrollHeight;
      const delta = newScrollHeight - prevScrollHeight;
      container.scrollTop = prevScrollTop + delta;
    });
  };

  useEffect(() => {
    if (!activeChat || !myUserId) return;
    const socket = getSocket({ requireConnected: false });
    if (!socket) return;

    messages.forEach((msg) => {
      if (msg.senderId !== myUserId && msg.status !== MessageStatus.READ) {
        socket.emit("message:read", { messageId: msg.id });
        updateStatus(msg.id, MessageStatus.READ);
        updateMessageStatus(msg.id, MessageStatus.READ);
      }
    });
  }, [messages, activeChat, myUserId, updateStatus]);

  const receiverId = useMemo(() => {
    if (!activeChat || !myUserId) return "";
    const other = activeChat.participants.find(
      (p: { id?: string } | null | undefined) => p?.id && p.id !== myUserId
    );
    return other?.id || "";
  }, [activeChat, myUserId]);

  const scrollToMessage = useCallback(async (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedMessageId(messageId);
      window.setTimeout(() => setFocusedMessageId((curr) => (curr === messageId ? null : curr)), 1400);
      return;
    }

    const fromDb = await getMessageById(messageId);
    if (!fromDb || (activeChat && fromDb.chatId !== activeChat.id)) return;
    addMessage(fromDb);
    requestAnimationFrame(() => {
      const hydratedTarget = messageRefs.current[messageId];
      if (!hydratedTarget) return;
      hydratedTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedMessageId(messageId);
      window.setTimeout(() => setFocusedMessageId((curr) => (curr === messageId ? null : curr)), 1400);
    });
  }, [activeChat, addMessage]);

  useEffect(() => {
    if (!searchOpen || !searchMatchedMessageIds.length) return;
    const clampedIndex = Math.min(searchActiveIndex, searchMatchedMessageIds.length - 1);
    if (clampedIndex !== searchActiveIndex) {
      setSearchActiveIndex(clampedIndex);
      return;
    }
    void scrollToMessage(searchMatchedMessageIds[clampedIndex]);
  }, [searchOpen, searchMatchedMessageIds, searchActiveIndex, scrollToMessage]);

  const contextMenuMessage = contextMenu ? messagesById.get(contextMenu.messageId) ?? null : null;

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const margin = 8;
    let nextX = contextMenu.x;
    let nextY = contextMenu.y;

    if (nextX + rect.width + margin > window.innerWidth) {
      nextX = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (nextY + rect.height + margin > window.innerHeight) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }

    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const close = () => setContextMenu(null);
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selectionMode) return;
    setContextMenu(null);
  }, [selectionMode]);

  const copyMessages = async (items: Message[]) => {
    if (!items.length) return;
    const payload = items
      .map((m) => m.text?.trim())
      .filter((t): t is string => Boolean(t))
      .join("\n");
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement("textarea");
      el.value = payload;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  };

  const beginReply = (message: Message) => {
    setReplyToMessage(message);
    setEditTarget(null);
  };

  const beginEdit = (message: Message) => {
    if (message.senderId !== myUserId) return;
    if (!message.text) return;
    setEditTarget(message);
    setReplyToMessage(null);
  };

  const togglePinForMessage = async (message: Message) => {
    const shouldPin = !message.pinned;
    const updated = await pinMessageOnServer(message.id, shouldPin);
    if (updated.pinned) {
      messages
        .filter((m) => m.chatId === updated.chatId && m.id !== updated.id && m.pinned)
        .forEach((m) => patchMessage(m.id, { pinned: false }));
    }
    patchMessage(updated.id, { pinned: updated.pinned, updatedAt: updated.updatedAt });
  };

  const openDeleteDialogFor = (items: Message[]) => {
    if (!items.length) return;
    const ids = items.map((m) => m.id).filter(Boolean);
    if (!ids.length) return;
    setDeleteTargetIds(ids);
    setDeleteDialogOpen(true);
  };

  const handleCopySelected = async () => {
    if (!canCopySelected) return;
    await copyMessages(selectedMessages);
    clearSelection();
  };

  const handleReplySelected = () => {
    if (!singleSelectedMessage || !canReplySelected) return;
    beginReply(singleSelectedMessage);
    clearSelection();
  };

  const handleEditSelected = () => {
    if (!singleSelectedMessage || !canEditSelected) return;
    beginEdit(singleSelectedMessage);
    clearSelection();
  };

  const handlePinSelected = async () => {
    if (!singleSelectedMessage || !canPinSelected) return;
    try {
      await togglePinForMessage(singleSelectedMessage);
    } catch (err) {
      console.error("Failed to pin/unpin message", err);
    } finally {
      clearSelection();
    }
  };

  const handleDeleteSelected = () => {
    if (!canDeleteSelected || !selectedMessages.length) return;
    openDeleteDialogFor(selectedMessages);
  };

  const handleDeleteForMe = async () => {
    const ids = deleteCandidates.map((m) => m.id);
    if (!ids.length) return;
    const localOnlyDeletedIds = deleteCandidates
      .filter((m) => m.deleted)
      .map((m) => m.id);

    try {
      const deletedIds = await deleteMessagesForMeOnServer(ids);
      const finalDeletedIds = Array.from(new Set([...deletedIds, ...localOnlyDeletedIds]));
      if (!finalDeletedIds.length) {
        clearSelection();
        setDeleteDialogOpen(false);
        setDeleteTargetIds(null);
        return;
      }

      removeMessages(finalDeletedIds);
      await deleteMessagesFromDB(finalDeletedIds);
      if (displayedPinnedMessage && finalDeletedIds.includes(displayedPinnedMessage.id)) {
        setFallbackPinnedMessage(null);
      }
      clearSelection();
      setDeleteDialogOpen(false);
      setDeleteTargetIds(null);
    } catch (err) {
      if (localOnlyDeletedIds.length) {
        removeMessages(localOnlyDeletedIds);
        await deleteMessagesFromDB(localOnlyDeletedIds);
      }
      clearSelection();
      setDeleteDialogOpen(false);
      setDeleteTargetIds(null);
      console.error("delete-for-me server sync failed", err);
    }
  };

  const handleDeleteForEveryone = async () => {
    const ids = deleteCandidates.map((m) => m.id);
    if (!ids.length) return;
    try {
      const deletedIds = await deleteMessagesForEveryoneOnServer(ids);
      if (!deletedIds.length) return;

      deletedIds.forEach((id) => {
        patchMessage(id, {
          deleted: true,
          text: "",
          edited: false,
          pinned: false,
          updatedAt: Date.now(),
        });
      });
      await Promise.all(
        deletedIds.map((id) =>
          patchMessageInDB(id, {
            deleted: true,
            text: "",
            edited: false,
            pinned: false,
            updatedAt: Date.now(),
          })
        )
      );
      if (displayedPinnedMessage && deletedIds.includes(displayedPinnedMessage.id)) {
        setFallbackPinnedMessage(null);
      }
    } catch (err) {
      console.error("delete-for-everyone failed", err);
    } finally {
      clearSelection();
      setDeleteDialogOpen(false);
      setDeleteTargetIds(null);
    }
  };

  const handleMessageContextMenu = (e: ReactMouseEvent<HTMLDivElement>, msg: Message) => {
    if (selectionMode) return;
    e.preventDefault();
    setContextMenu({ messageId: msg.id, x: e.clientX, y: e.clientY });
  };

  const handleContextAction = async (action: "copy" | "reply" | "edit" | "pin" | "delete") => {
    if (!contextMenuMessage) return;
    const canCopy = canCopyMessage(contextMenuMessage);
    const canReply = canReplyMessage(contextMenuMessage);
    const canEdit = canEditMessage(contextMenuMessage);
    const canPin = canPinMessage(contextMenuMessage);
    const canDelete = canDeleteMessage(contextMenuMessage);

    try {
      if (action === "copy" && canCopy) await copyMessages([contextMenuMessage]);
      if (action === "reply" && canReply) beginReply(contextMenuMessage);
      if (action === "edit" && canEdit) beginEdit(contextMenuMessage);
      if (action === "pin" && canPin) await togglePinForMessage(contextMenuMessage);
      if (action === "delete" && canDelete) openDeleteDialogFor([contextMenuMessage]);
    } catch (err) {
      if (action === "pin") console.error("Failed to pin/unpin message", err);
    } finally {
      setContextMenu(null);
    }
  };

  const unpinCurrent = async () => {
    if (!displayedPinnedMessage) return;
    try {
      const updated = await pinMessageOnServer(displayedPinnedMessage.id, false);
      patchMessage(updated.id, { pinned: false, updatedAt: updated.updatedAt });
      setFallbackPinnedMessage(null);
    } catch (err) {
      console.error("Failed to unpin message", err);
      setFallbackPinnedMessage(null);
    }
  };

  const handleDeleteChatForMe = async () => {
    if (!pendingDeleteChat) return;
    await deleteChatForMe(pendingDeleteChat.id);
    removeChatMessages(pendingDeleteChat.id);
    cancelDeleteChatRequest();
  };

  const handleToggleSearch = () => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery("");
        setSearchActiveIndex(0);
      }
      return !prev;
    });
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setSearchActiveIndex(0);
  };

  const handleSearchNavigate = (direction: 1 | -1) => {
    if (!searchMatchedMessageIds.length) return;
    setSearchActiveIndex((prev) => (prev + direction + searchMatchedMessageIds.length) % searchMatchedMessageIds.length);
  };

  const applySelectionAtPointer = (pointerOverride?: { x: number; y: number }) => {
    const pointer = pointerOverride ?? lastPointerRef.current;
    if (!pointer) return;
    const target = document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null;
    const keyedContainer = target?.closest("[data-selection-key]") as HTMLElement | null;
    const key = keyedContainer?.dataset.selectionKey;
    if (!key) return;
    if (dragLastKeyRef.current === key) return;
    const msg = messagesBySelectionKey.get(key);
    if (!msg) return;
    dragMovedRef.current = true;
    applySelectionDuringDrag(msg);
    dragLastKeyRef.current = key;
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#eaeff2",
        color: "#e9edef",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ backgroundColor: "#ffffff", color: "#000000", flexShrink: 0 }}>
        <ChatHeader
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          singleSelectedMessage={singleSelectedMessage}
          canCopySelected={canCopySelected}
          canReplySelected={canReplySelected}
          canEditSelected={canEditSelected}
          canPinSelected={canPinSelected}
          canDeleteSelected={canDeleteSelected}
          onClearSelection={clearSelection}
          onCopySelected={handleCopySelected}
          onReplySelected={handleReplySelected}
          onEditSelected={handleEditSelected}
          onPinSelected={handlePinSelected}
          onDeleteSelected={handleDeleteSelected}
          searchOpen={!selectionMode && searchOpen}
          searchQuery={searchQuery}
          searchMatchCount={searchMatchedMessageIds.length}
          searchCurrentIndex={searchActiveIndex}
          onToggleSearch={handleToggleSearch}
          onSearchQueryChange={handleSearchQueryChange}
          onSearchPrev={() => handleSearchNavigate(-1)}
          onSearchNext={() => handleSearchNavigate(1)}
        />
      </div>

      {!selectionMode && displayedPinnedMessage && (
        <div
          style={{
            background: "#e8f1ff",
            borderBottom: "1px solid #c2d7ff",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
            onClick={() => scrollToMessage(displayedPinnedMessage.id)}
          >
            <div style={{ color: "#0b5cff", fontSize: 12, fontWeight: 700 }}>Pinned message</div>
            <div
              style={{
                color: "#1a1a1a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayedPinnedMessage.text ?? "Media message"}
            </div>
          </div>
          <button
            type="button"
            onClick={unpinCurrent}
            style={{
              border: "none",
              background: "#0b5cff",
              color: "#fff",
              borderRadius: 6,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Unpin
          </button>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const threshold = 40;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
          isUserAtBottomRef.current = atBottom;
          if (selectionMode && dragSelectingRef.current && isLeftMouseDownRef.current) {
            applySelectionAtPointer();
          }
          if (allowLoadOlderRef.current && el.scrollTop < 60) {
            loadOlderMessages();
          }
        }}
        style={{
          flex: 1,
          padding: "16px 24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          backgroundImage: "url('/src/background-image.jpg')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "auto",
        }}
      >
        {!activeChat && (
          <div style={{ margin: "auto", color: "#8696a0", fontSize: 40 }}>
            Select a chat to start messaging
          </div>
        )}

        {activeChat &&
          messages.map((msg, index) => {
            const previous = index > 0 ? messages[index - 1] : null;
            const showDateDivider =
              !previous || getDateGroupKey(previous.createdAt) !== getDateGroupKey(msg.createdAt);

            return (
              <div key={msg.clientId ?? msg.id}>
                {showDateDivider && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      margin: "6px 0",
                    }}
                  >
                    <span
                      style={{
                        width: "100%",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#4f5b62",
                        background: "rgba(255, 255, 255, 0.86)",
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        borderRadius: 999,
                        padding: "4px 12px",
                        backdropFilter: "blur(2px)",
                      }}
                    >
                      {formatDateDivider(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  data-selection-key={getSelectionKey(msg)}
                  ref={(el) => {
                    messageRefs.current[msg.id] = el;
                  }}
                >
                  <MessageBubble
                    message={msg}
                    myUserId={myUserId!}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(getSelectionKey(msg))}
                    isFocused={focusedMessageId === msg.id}
                    replyToMessage={msg.replyTo ? messagesById.get(msg.replyTo) ?? null : null}
                    onReplyPreviewClick={scrollToMessage}
                    onEnterSelectionMode={enterSelectionMode}
                    onToggleSelection={toggleSelection}
                    onContextMenu={handleMessageContextMenu}
                    onSelectionDragStart={handleSelectionDragStart}
                    onSelectionDragEnter={handleSelectionDragEnter}
                    shouldSuppressSelectionClick={shouldSuppressSelectionClick}
                  />
                </div>
              </div>
            );
          })}

        <div ref={messagesEndRef} />
      </div>

      {contextMenu && contextMenuMessage && (
        <div
          ref={contextMenuRef}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            minWidth: 180,
            overflow: "hidden",
            zIndex: 1300,
            border: "1px solid #e8e8e8",
          }}
        >
          <MenuActionButton
            label="Copy"
            disabled={!canCopyMessage(contextMenuMessage)}
            onClick={() => handleContextAction("copy")}
          />
          <MenuActionButton
            label="Reply"
            disabled={!canReplyMessage(contextMenuMessage)}
            onClick={() => handleContextAction("reply")}
          />
          <MenuActionButton
            label="Edit"
            disabled={!canEditMessage(contextMenuMessage)}
            onClick={() => handleContextAction("edit")}
          />
          <MenuActionButton
            label={contextMenuMessage.pinned ? "Unpin" : "Pin"}
            disabled={!canPinMessage(contextMenuMessage)}
            onClick={() => handleContextAction("pin")}
          />
          <MenuActionButton
            label="Delete"
            danger
            disabled={!canDeleteMessage(contextMenuMessage)}
            onClick={() => handleContextAction("delete")}
          />
        </div>
      )}

      {isTyping && (
        <div
          style={{
            height: 28,
            width: "100%",
            paddingLeft: window.innerWidth < 600 ? 48 : 60,
            display: "flex",
            backgroundColor: "#00fec7",
            alignItems: "center",
          }}
        >
          <TypingDots />
        </div>
      )}

      <div
        style={{
          minHeight: 72,
          padding: "8px 16px",
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          backgroundImage: "url('/src/background-image.jpg')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "auto",
          flexShrink: 0,
        }}
      >
        <MessageInput
          chatId={activeChat?.id || ""}
          receiverId={receiverId}
          disabled={!activeChat || !token}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
          editTarget={editTarget}
          onCancelEdit={() => setEditTarget(null)}
        />
      </div>

      {deleteDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
          onClick={() => {
            setDeleteDialogOpen(false);
            setDeleteTargetIds(null);
          }}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, minWidth: 280, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#000" }}>Delete messages?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={handleDeleteForMe}
                style={{
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid #d0d0d0",
                  background: "#f2f2f2",
                  cursor: "pointer",
                }}
              >
                Delete for me
              </button>
              {canDeleteForEveryone && (
                <button
                  type="button"
                  onClick={handleDeleteForEveryone}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "1px solid #e79b9b",
                    background: "#fef0f0",
                    color: "#cc2020",
                    cursor: "pointer",
                  }}
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteTargetIds(null);
                }}
                style={{
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid #d0d0d0",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1250,
          }}
          onClick={cancelDeleteChatRequest}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, minWidth: 300, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#000" }}>
              Delete chat?
            </div>
            <div style={{ fontSize: 14, color: "#444", marginBottom: 14 }}>
              Do you really want to delete this chat from this device?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={cancelDeleteChatRequest}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid #d0d0d0",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteChatForMe}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid #e79b9b",
                  background: "#fef0f0",
                  color: "#cc2020",
                  cursor: "pointer",
                }}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuActionButton({
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 16,
        color: disabled ? "#9aa0a6" : danger ? "#d32f2f" : "#000",
        border: "none",
        background: "#fff",
        borderBottom: "1px solid #eee",
        opacity: disabled ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? "#fff4f4" : "#f4f7ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}



