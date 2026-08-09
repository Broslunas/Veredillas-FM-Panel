'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Video,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  Info,
  Eye,
  Tag,
  Folder,
  X,
  RefreshCw,
  Search,
  Filter,
  ThumbsUp,
  MessageSquare,
  Edit,
  Trash2,
  Copy,
  Users,
  Film,
  Globe,
  Lock,
  EyeOff,
  Calendar,
  Check,
  ListPlus,
  Radio,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';

interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
}

interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  viewCount: string;
  likeCount: string;
  commentCount: string;
  durationSeconds: number;
  durationFormatted: string;
  videoType: 'short' | 'normal';
}

interface YouTubePlaylistItem {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
  thumbnail: string;
}

interface YouTubeCommentThreadItem {
  id: string;
  videoId?: string;
  authorName: string;
  authorProfileImage: string;
  textDisplay: string;
  publishedAt: string;
  likeCount: number;
}

interface YouTubeLiveBroadcastItem {
  id: string;
  title: string;
  scheduledStartTime: string;
  lifeCycleStatus: string;
  streamName?: string;
  rtmpUrl?: string;
}

const CATEGORIES = [
  { id: '22', name: 'Gente y Blogs' },
  { id: '27', name: 'Educación' },
  { id: '24', name: 'Entretenimiento' },
  { id: '10', name: 'Música' },
  { id: '25', name: 'Noticias y Política' },
  { id: '28', name: 'Ciencia y Tecnología' },
  { id: '19', name: 'Viajes y Eventos' },
];

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function YouTubeStudioPage() {
  const [activeTab, setActiveTab] = useState<'videos' | 'playlists' | 'comments' | 'live' | 'upload'>('videos');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Videos & Analytics states
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'normal' | 'short'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination & Page Size states
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [prevPageToken, setPrevPageToken] = useState<string | undefined>(undefined);
  const [currentPageToken, setCurrentPageToken] = useState<string>('');
  const [pageHistory, setPageHistory] = useState<string[]>(['']);
  const [pageIndex, setPageIndex] = useState(0);

  // Selection / Bulk Operations
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Playlists states
  const [playlists, setPlaylists] = useState<YouTubePlaylistItem[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<YouTubePlaylistItem | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [playlistPrivacy, setPlaylistPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  // Add Video to Playlist Modal
  const [addToPlaylistVideo, setAddToPlaylistVideo] = useState<YouTubeVideoItem | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);

  // Comments states
  const [comments, setComments] = useState<YouTubeCommentThreadItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Live Broadcasts states
  const [broadcasts, setBroadcasts] = useState<YouTubeLiveBroadcastItem[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [scheduleLiveOpen, setScheduleLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDesc, setLiveDesc] = useState('');
  const [liveStartTime, setLiveStartTime] = useState('');
  const [schedulingLive, setSchedulingLive] = useState(false);
  const [createdLiveDetails, setCreatedLiveDetails] = useState<{ streamName: string; rtmpUrl: string } | null>(null);

  // Edit Video Modal state
  const [editingVideo, setEditingVideo] = useState<YouTubeVideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Video Modal state
  const [deletingVideo, setDeletingVideo] = useState<YouTubeVideoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [categoryId, setCategoryId] = useState('22');
  const [tagsInput, setTagsInput] = useState('podcast, veredillas fm, radio');
  
  // File states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Upload progress states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropperContainerRef = useRef<HTMLDivElement>(null);
  const cropperImageRef = useRef<HTMLImageElement>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (configured) {
      if (activeTab === 'videos') fetchVideos(currentPageToken, pageSize);
      if (activeTab === 'playlists') fetchPlaylists();
      if (activeTab === 'comments') fetchComments();
      if (activeTab === 'live') fetchBroadcasts();
    }
  }, [configured, activeTab, currentPageToken, pageSize]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/youtube/status');
      const data = await res.json();
      if (res.ok) {
        setConfigured(data.configured);
        setMissingKeys(data.missing || []);
        setChannel(data.channel || null);
        if (data.error) setStatusError(data.error);
      } else {
        setStatusError(data.error || 'Error al verificar estado de la API de YouTube');
      }
    } catch {
      setStatusError('Error de red al conectar con el servidor');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchVideos = async (token = '', limit = pageSize) => {
    setLoadingVideos(true);
    setSelectedVideoIds([]);
    try {
      const res = await fetch(`/api/youtube/videos?pageToken=${token}&maxResults=${limit}`);
      const data = await res.json();
      if (res.ok) {
        setVideos(data.videos || []);
        setNextPageToken(data.nextPageToken);
        setPrevPageToken(data.prevPageToken);
        setTotalResults(data.totalResults || data.videos?.length || 0);
      }
    } catch (err) {
      console.error('Error cargando vídeos:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const res = await fetch('/api/youtube/playlists');
      const data = await res.json();
      if (res.ok) setPlaylists(data.playlists || []);
    } catch (err) {
      console.error('Error cargando listas:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch('/api/youtube/comments');
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch (err) {
      console.error('Error cargando comentarios:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const res = await fetch('/api/youtube/live');
      const data = await res.json();
      if (res.ok) setBroadcasts(data.broadcasts || []);
    } catch (err) {
      console.error('Error cargando directos:', err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const handleConnectChannel = async () => {
    try {
      const res = await fetch('/api/youtube/auth/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'No se pudo generar la URL de autorización');
      }
    } catch {
      alert('Error de red al conectar con la API de autenticación');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Pagination navigation
  const handleNextPage = () => {
    if (nextPageToken) {
      const nextHist = [...pageHistory, nextPageToken];
      setPageHistory(nextHist);
      setPageIndex(pageIndex + 1);
      setCurrentPageToken(nextPageToken);
    }
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      const prevIndex = pageIndex - 1;
      setPageIndex(prevIndex);
      setCurrentPageToken(pageHistory[prevIndex] || '');
    }
  };

  // Selection & Bulk Operations
  const toggleSelectAll = () => {
    if (selectedVideoIds.length === filteredVideos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(filteredVideos.map((v) => v.id));
    }
  };

  const toggleSelectVideo = (id: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkPrivacyChange = async (privacy: 'public' | 'unlisted' | 'private') => {
    if (selectedVideoIds.length === 0) return;
    setBulkProcessing(true);

    try {
      for (const id of selectedVideoIds) {
        const vid = videos.find((v) => v.id === id);
        if (vid) {
          await fetch(`/api/youtube/videos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: vid.title,
              description: vid.description,
              privacyStatus: privacy,
            }),
          });
        }
      }
      alert('Visibilidad de vídeos seleccionados actualizada.');
      fetchVideos(currentPageToken);
    } catch (err: any) {
      alert(err.message || 'Error en operación masiva.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideoIds.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${selectedVideoIds.length} vídeos seleccionados de YouTube?`)) return;
    setBulkProcessing(true);

    try {
      for (const id of selectedVideoIds) {
        await fetch(`/api/youtube/videos/${id}`, { method: 'DELETE' });
      }
      alert('Vídeos eliminados con éxito de YouTube.');
      fetchVideos(currentPageToken);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar vídeos.');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Playlists handlers
  const openCreatePlaylist = () => {
    setEditingPlaylist(null);
    setPlaylistTitle('');
    setPlaylistDesc('');
    setPlaylistPrivacy('public');
    setCreatePlaylistOpen(true);
  };

  const openEditPlaylist = (pl: YouTubePlaylistItem) => {
    setEditingPlaylist(pl);
    setPlaylistTitle(pl.title);
    setPlaylistDesc(pl.description);
    setPlaylistPrivacy(pl.privacyStatus);
    setCreatePlaylistOpen(true);
  };

  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistTitle.trim()) return;
    setSavingPlaylist(true);

    try {
      if (editingPlaylist) {
        const res = await fetch(`/api/youtube/playlists/${editingPlaylist.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: playlistTitle,
            description: playlistDesc,
            privacyStatus: playlistPrivacy,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar lista');
      } else {
        const res = await fetch('/api/youtube/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: playlistTitle,
            description: playlistDesc,
            privacyStatus: playlistPrivacy,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear lista');
      }

      setCreatePlaylistOpen(false);
      fetchPlaylists();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la lista de reproducción.');
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta lista de reproducción?')) return;
    try {
      const res = await fetch(`/api/youtube/playlists/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar lista');
      }
      fetchPlaylists();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Video to Playlist
  const handleAddToPlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addToPlaylistVideo || !selectedPlaylistId) return;
    setAddingToPlaylist(true);

    try {
      const res = await fetch(`/api/youtube/playlists/${selectedPlaylistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: addToPlaylistVideo.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al añadir vídeo');

      alert('¡Vídeo añadido a la lista de reproducción!');
      setAddToPlaylistVideo(null);
      fetchPlaylists();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingToPlaylist(false);
    }
  };

  // Reply Comment handler
  const handleSendReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/youtube/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: commentId, text: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al responder');

      setReplyingCommentId(null);
      setReplyText('');
      alert('¡Respuesta publicada con éxito en YouTube!');
      fetchComments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este comentario de YouTube?')) return;
    try {
      const res = await fetch(`/api/youtube/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      fetchComments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Live Broadcast handler
  const handleScheduleLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle || !liveStartTime) return;
    setSchedulingLive(true);

    try {
      const res = await fetch('/api/youtube/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: liveTitle,
          description: liveDesc,
          scheduledStartTime: new Date(liveStartTime).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al programar directo');

      setCreatedLiveDetails({
        streamName: data.streamName,
        rtmpUrl: data.rtmpUrl,
      });

      setScheduleLiveOpen(false);
      setLiveTitle('');
      setLiveDesc('');
      fetchBroadcasts();
    } catch (err: any) {
      alert(err.message || 'Error al programar la emisión en directo.');
    } finally {
      setSchedulingLive(false);
    }
  };

  // Edit Video handler
  const openEditModal = (video: YouTubeVideoItem) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setEditPrivacy(video.privacyStatus);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    setSavingEdit(true);

    try {
      const res = await fetch(`/api/youtube/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          privacyStatus: editPrivacy,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar cambios');

      setEditingVideo(null);
      fetchVideos(currentPageToken);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar el vídeo.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Video handler
  const handleDeleteVideo = async () => {
    if (!deletingVideo) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/youtube/videos/${deletingVideo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar vídeo');

      setDeletingVideo(null);
      fetchVideos(currentPageToken);
      fetchStatus();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el vídeo.');
    } finally {
      setDeleting(false);
    }
  };

  // Video Upload Handlers
  const handleVideoSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Por favor selecciona un archivo de vídeo válido (MP4, MOV, MKV, etc.).');
      return;
    }
    setVideoFile(file);
    if (!title) {
      const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(fileNameWithoutExt);
    }
  };

  const handleThumbnailSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG).');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      setCropperSrc(reader.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropSave = () => {
    if (!cropperContainerRef.current || !cropperImageRef.current || !cropperSrc) return;

    const viewportRect = cropperContainerRef.current.getBoundingClientRect();
    const imgRect = cropperImageRef.current.getBoundingClientRect();

    const scale = 1280 / viewportRect.width;

    const destX = (imgRect.left - viewportRect.left) * scale;
    const destY = (imgRect.top - viewportRect.top) * scale;
    const destWidth = imgRect.width * scale;
    const destHeight = imgRect.height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(img, destX, destY, destWidth, destHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const croppedFile = new File([blob], 'thumbnail.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              setThumbnailFile(croppedFile);
              const previewUrl = URL.createObjectURL(croppedFile);
              setThumbnailPreview(previewUrl);
              setCropperOpen(false);
            }
          },
          'image/jpeg',
          0.92
        );
      };
      img.src = cropperSrc;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingImage(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const nextZoom = e.deltaY < 0 ? zoom + zoomFactor : zoom - zoomFactor;
    setZoom(Math.max(1, Math.min(5, nextZoom)));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      alert('Debes seleccionar un vídeo para subir.');
      return;
    }
    if (!title.trim()) {
      alert('Debes indicar un título para el vídeo.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedVideoId(null);
    setUploadError(null);
    setStatusMessage('Iniciando sesión de subida en YouTube...');

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const sessionRes = await fetch('/api/youtube/upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          tags,
          categoryId,
          privacyStatus,
          mimeType: videoFile.type || 'video/mp4',
          fileSize: videoFile.size,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.uploadUrl) {
        throw new Error(sessionData.error || 'No se pudo iniciar la sesión de subida.');
      }

      const { uploadUrl } = sessionData;

      setStatusMessage('Subiendo vídeo a YouTube...');

      const videoId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4');

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percentComplete = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const resp = JSON.parse(xhr.responseText);
              if (resp.id) {
                resolve(resp.id);
              } else {
                reject(new Error('Subida completada pero no se recibió el ID del vídeo.'));
              }
            } catch {
              reject(new Error('Respuesta inválida del servidor de YouTube.'));
            }
          } else {
            reject(new Error(`Error al transmitir el vídeo a YouTube (HTTP ${xhr.status}): ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Error de conexión durante la subida del vídeo.'));
        xhr.send(videoFile);
      });

      setUploadedVideoId(videoId);
      setStatusMessage('¡Vídeo subido con éxito!');

      if (thumbnailFile) {
        setStatusMessage('Estableciendo miniatura personalizada...');
        const formData = new FormData();
        formData.append('videoId', videoId);
        formData.append('thumbnail', thumbnailFile);

        const thumbRes = await fetch('/api/youtube/upload/thumbnail', {
          method: 'POST',
          body: formData,
        });

        if (!thumbRes.ok) {
          const thumbData = await thumbRes.json();
          console.warn('Advertencia en miniatura:', thumbData.error);
        } else {
          setStatusMessage('¡Vídeo y miniatura subidos con éxito!');
        }
      }

      fetchVideos(currentPageToken);
      fetchStatus();
    } catch (err: any) {
      console.error('Error en proceso de subida:', err);
      setUploadError(err.message || 'Ocurrió un error inesperado al subir el vídeo.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setVideoFile(null);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setTitle('');
    setDescription('');
    setUploadedVideoId(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  // Filter Videos by Search, Privacy, Type (Short vs Normal) and Duration
  const filteredVideos = videos.filter((vid) => {
    const matchesSearch =
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vid.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPrivacy = privacyFilter === 'all' || vid.privacyStatus === privacyFilter;
    const matchesType = typeFilter === 'all' || vid.videoType === typeFilter;
    
    let matchesDuration = true;
    if (durationFilter === 'short') matchesDuration = vid.durationSeconds < 240; // < 4 min
    else if (durationFilter === 'medium') matchesDuration = vid.durationSeconds >= 240 && vid.durationSeconds <= 1200; // 4 - 20 min
    else if (durationFilter === 'long') matchesDuration = vid.durationSeconds > 1200; // > 20 min

    return matchesSearch && matchesPrivacy && matchesType && matchesDuration;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 shadow-lg shadow-red-600/10">
            <YoutubeIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
              YouTube Studio
              <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                Advanced Control Suite
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Filtros por duración (Shorts / Vídeos), listas de reproducción, moderación y emisiones RTMP.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchStatus();
              if (activeTab === 'videos') fetchVideos(currentPageToken);
              if (activeTab === 'playlists') fetchPlaylists();
              if (activeTab === 'comments') fetchComments();
              if (activeTab === 'live') fetchBroadcasts();
            }}
            disabled={loadingStatus}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 transition"
          >
            <UploadCloud className="w-4 h-4" />
            Subir Vídeo
          </button>
        </div>
      </div>

      {/* Channel Header & Metrics Cards */}
      {loadingStatus ? (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-center gap-3 text-zinc-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
          <span>Conectando con YouTube Data API v3...</span>
        </div>
      ) : configured && channel ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-red-950/40 via-zinc-900/90 to-zinc-900/90 border border-red-900/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
            <div className="flex items-center gap-4">
              {channel.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channel.thumbnail}
                  alt={channel.title}
                  className="w-14 h-14 rounded-full border-2 border-red-500/50 object-cover shrink-0 shadow-lg shadow-red-950/40"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold shrink-0">
                  YT
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-100">{channel.title}</h2>
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Canal Conectado
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xl">
                  {channel.customUrl || channel.description || 'Canal oficial de Veredillas FM'}
                </p>
              </div>
            </div>

            <a
              href={`https://youtube.com/channel/${channel.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition border border-zinc-700/60 shrink-0"
            >
              Abrir Canal en YouTube <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Visualizaciones Totales</p>
                <p className="text-xl font-bold text-zinc-100 font-mono mt-0.5">
                  {channel.viewCount ? Number(channel.viewCount).toLocaleString('es-ES') : '—'}
                </p>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Suscriptores</p>
                <p className="text-xl font-bold text-zinc-100 font-mono mt-0.5">
                  {channel.subscriberCount ? Number(channel.subscriberCount).toLocaleString('es-ES') : '—'}
                </p>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Vídeos Publicados</p>
                <p className="text-xl font-bold text-zinc-100 font-mono mt-0.5">
                  {channel.videoCount ? Number(channel.videoCount).toLocaleString('es-ES') : videos.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-200">
                Canal de YouTube pendiente de vinculación
              </h3>
              <p className="text-xs text-zinc-300">
                {statusError ||
                  'Falta el token de actualización de larga duración (YOUTUBE_REFRESH_TOKEN) en el servidor.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleConnectChannel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 transition"
            >
              <YoutubeIcon className="w-4 h-4" />
              Conectar Canal de YouTube (Generar Refresh Token)
            </button>
            <a
              href="/GUIA_YOUTUBE_CREDENTIALS.md"
              target="_blank"
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-mono"
            >
              <Info className="w-3.5 h-3.5" /> Ver guía de credenciales (.md)
            </a>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="border-b border-zinc-800 flex flex-wrap items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('videos')}
          className={`pb-3 flex items-center gap-2 transition border-b-2 ${
            activeTab === 'videos'
              ? 'border-red-500 text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Film className="w-4 h-4 text-indigo-400" />
          Vídeos ({filteredVideos.length})
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`pb-3 flex items-center gap-2 transition border-b-2 ${
            activeTab === 'playlists'
              ? 'border-red-500 text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ListPlus className="w-4 h-4 text-indigo-400" />
          Playlists ({playlists.length})
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-3 flex items-center gap-2 transition border-b-2 ${
            activeTab === 'comments'
              ? 'border-red-500 text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          Comentarios ({comments.length})
        </button>

        <button
          onClick={() => setActiveTab('live')}
          className={`pb-3 flex items-center gap-2 transition border-b-2 ${
            activeTab === 'live'
              ? 'border-red-500 text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          Directos RTMP
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-3 flex items-center gap-2 transition border-b-2 ${
            activeTab === 'upload'
              ? 'border-red-500 text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-indigo-400" />
          Subir Nuevo Vídeo
        </button>
      </div>

      {/* TAB 1: VIDEOS CATALOG, FILTERS & PAGINATION */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          {/* Advanced Multi-Filters Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/40 p-4 border border-zinc-800 rounded-2xl">
            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por título o contenido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter (Short vs Normal) */}
              <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    typeFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setTypeFilter('normal')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    typeFilter === 'normal' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Film className="w-3 h-3 text-indigo-400" /> Vídeos
                </button>
                <button
                  onClick={() => setTypeFilter('short')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    typeFilter === 'short' ? 'bg-red-950/60 text-red-300 font-semibold border border-red-800/40' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3 h-3 text-red-500" /> Shorts (≤60s)
                </button>
              </div>

              {/* Duration Filter */}
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={durationFilter}
                  onChange={(e: any) => setDurationFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="all">Toda duración</option>
                  <option value="short">Cortos (&lt; 4 min)</option>
                  <option value="medium">Medios (4 - 20 min)</option>
                  <option value="long">Largos (&gt; 20 min)</option>
                </select>
              </div>

              {/* Privacy Filter */}
              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={privacyFilter}
                  onChange={(e: any) => setPrivacyFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="all">Todas las visibilidades</option>
                  <option value="public">Públicos</option>
                  <option value="unlisted">Ocultos</option>
                  <option value="private">Privados</option>
                </select>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1 text-xs">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPageSize(newSize);
                    setPageIndex(0);
                    setCurrentPageToken('');
                    setPageHistory(['']);
                  }}
                  className="bg-zinc-950 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition font-medium"
                >
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                  <option value={200}>200 (Cargar todo el canal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Action Bar (When videos selected) */}
          {selectedVideoIds.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-3 flex items-center justify-between gap-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>{selectedVideoIds.length} vídeos seleccionados</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkPrivacyChange('public')}
                  disabled={bulkProcessing}
                  className="px-3 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-medium hover:bg-emerald-900 transition"
                >
                  Marcar Públicos
                </button>
                <button
                  onClick={() => handleBulkPrivacyChange('unlisted')}
                  disabled={bulkProcessing}
                  className="px-3 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-medium hover:bg-amber-900 transition"
                >
                  Marcar Ocultos
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkProcessing}
                  className="px-3 py-1 bg-red-950/80 text-red-300 border border-red-800/60 rounded-lg text-xs font-medium hover:bg-red-900 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Eliminar Selección
                </button>
                <button
                  onClick={() => setSelectedVideoIds([])}
                  className="text-xs text-zinc-400 hover:text-zinc-200 ml-2"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>
          )}

          {/* Select All Row */}
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 hover:text-zinc-200 transition"
            >
              {selectedVideoIds.length === filteredVideos.length && filteredVideos.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-zinc-500" />
              )}
              <span>Seleccionar todos los de esta página</span>
            </button>

            <span>Mostrando {filteredVideos.length} de {totalResults || videos.length} vídeos (Página {pageIndex + 1})</span>
          </div>

          {/* Videos Grid */}
          {loadingVideos ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <span>Cargando vídeos y métricas...</span>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 space-y-2">
              <Film className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-sm text-zinc-300 font-medium">No se encontraron vídeos</p>
              <p className="text-xs text-zinc-500">Prueba a ajustar los filtros superiores.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideoIds.includes(video.id);

                return (
                  <div
                    key={video.id}
                    className={`bg-zinc-900/60 border rounded-2xl overflow-hidden hover:border-zinc-700/80 transition flex flex-col justify-between group shadow-lg relative ${
                      isSelected ? 'border-indigo-500/80 ring-1 ring-indigo-500/30' : 'border-zinc-800/90'
                    }`}
                  >
                    <div>
                      {/* Selection Checkbox */}
                      <button
                        onClick={() => toggleSelectVideo(video.id)}
                        className="absolute top-2.5 left-2.5 z-20 p-1.5 rounded-lg bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white transition"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>

                      {/* Video Thumbnail Header with Badges */}
                      <div className="aspect-video relative overflow-hidden bg-zinc-950 group-hover:opacity-95 transition">
                        {video.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Film className="w-8 h-8" />
                          </div>
                        )}

                        {/* Shorts or Duration Badge */}
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
                          {video.videoType === 'short' && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow">
                              <Zap className="w-3 h-3 fill-white" /> SHORT
                            </span>
                          )}
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-950/85 text-zinc-200 border border-zinc-800 backdrop-blur-md shadow">
                            {video.durationFormatted}
                          </span>
                        </div>

                        {/* Privacy Badge */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          {video.privacyStatus === 'public' && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/90 text-zinc-950 font-bold backdrop-blur-md shadow">
                              <Globe className="w-3 h-3" /> Público
                            </span>
                          )}
                          {video.privacyStatus === 'unlisted' && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/90 text-zinc-950 font-bold backdrop-blur-md shadow">
                              <EyeOff className="w-3 h-3" /> Oculto
                            </span>
                          )}
                          {video.privacyStatus === 'private' && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-700/90 text-white font-bold backdrop-blur-md shadow">
                              <Lock className="w-3 h-3" /> Privado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Video Details */}
                      <div className="p-4 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-red-400 transition">
                          {video.title}
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {video.description || 'Sin descripción'}
                        </p>

                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono pt-1">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>{new Date(video.publishedAt).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics & Actions Footer */}
                    <div className="p-4 pt-0 space-y-3">
                      <div className="grid grid-cols-3 gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60 text-center font-mono text-[11px]">
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Vistas</span>
                          <span className="font-semibold text-zinc-200">{Number(video.viewCount).toLocaleString('es-ES')}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Me gusta</span>
                          <span className="font-semibold text-zinc-200">{Number(video.likeCount).toLocaleString('es-ES')}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase">Comentarios</span>
                          <span className="font-semibold text-zinc-200">{Number(video.commentCount).toLocaleString('es-ES')}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(`https://youtu.be/${video.id}`, video.id)}
                            title="Copiar enlace"
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                          >
                            {copiedId === video.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={`https://youtu.be/${video.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Ver en YouTube"
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setAddToPlaylistVideo(video)}
                            title="Añadir a Playlist"
                            className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(video)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700/60 transition"
                          >
                            <Edit className="w-3 h-3 text-indigo-400" /> Editar
                          </button>
                          <button
                            onClick={() => setDeletingVideo(video)}
                            title="Eliminar"
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Toolbar */}
          <div className="flex items-center justify-between bg-zinc-900/40 p-4 border border-zinc-800 rounded-2xl text-xs font-medium">
            <button
              onClick={handlePrevPage}
              disabled={pageIndex === 0 || loadingVideos}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition text-zinc-200"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <span className="text-zinc-400 font-mono">Página {pageIndex + 1}</span>

            <button
              onClick={handleNextPage}
              disabled={!nextPageToken || loadingVideos}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition text-zinc-200"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PLAYLISTS WITH EDIT SUPPORT */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Listas de Reproducción del Canal</h2>
              <p className="text-xs text-zinc-400">Crea y edita las listas de reproducción de tu canal de YouTube.</p>
            </div>
            <button
              onClick={openCreatePlaylist}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <ListPlus className="w-4 h-4" /> Crear Nueva Playlist
            </button>
          </div>

          {loadingPlaylists ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <span>Cargando listas de reproducción...</span>
            </div>
          ) : playlists.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500 text-xs">
              No se encontraron listas de reproducción creadas.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => (
                <div key={pl.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">{pl.title}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {pl.itemCount} vídeos
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{pl.description || 'Sin descripción'}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
                    <a
                      href={`https://youtube.com/playlist?list=${pl.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Abrir Playlist <ExternalLink className="w-3 h-3" />
                    </a>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditPlaylist(pl)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                        title="Editar detalles de la Playlist"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlaylist(pl.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                        title="Eliminar Playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMMENTS & MODERATION */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
            <h2 className="text-sm font-semibold text-zinc-100">Moderación de Comentarios</h2>
            <p className="text-xs text-zinc-400">Lee y responde a los oyentes directamente en tu canal de YouTube.</p>
          </div>

          {loadingComments ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <span>Cargando comentarios recientes...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500 text-xs">
              No hay comentarios recientes en los vídeos.
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {c.authorProfileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.authorProfileImage} alt={c.authorName} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300">
                          {c.authorName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">{c.authorName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-2">
                          {new Date(c.publishedAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      title="Eliminar comentario"
                      className="text-zinc-500 hover:text-red-400 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60">
                    {c.textDisplay}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1 text-zinc-500 text-[11px]">
                      <ThumbsUp className="w-3 h-3 text-zinc-400" /> {c.likeCount} me gusta
                    </div>

                    {replyingCommentId === c.id ? (
                      <div className="w-full flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Escribe tu respuesta pública..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSendReply(c.id)}
                          disabled={sendingReply}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                        >
                          {sendingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Responder
                        </button>
                        <button
                          onClick={() => setReplyingCommentId(null)}
                          className="text-zinc-500 hover:text-zinc-300 text-xs px-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingCommentId(c.id);
                          setReplyText('');
                        }}
                        className="text-indigo-400 hover:underline text-xs flex items-center gap-1"
                      >
                        Responder desde Veredillas FM
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE BROADCASTS */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Transmisiones en Directo (RTMP)</h2>
              <p className="text-xs text-zinc-400">Programa directos en YouTube y obtén claves de emisión para OBS Studio o vMix.</p>
            </div>
            <button
              onClick={() => setScheduleLiveOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 transition"
            >
              <Radio className="w-4 h-4" /> Programar Emisión RTMP
            </button>
          </div>

          {createdLiveDetails && (
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ¡Emisión programada con éxito!
              </h3>
              <div className="space-y-2 text-xs font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500 block">Servidor RTMP:</span>
                  <span className="text-zinc-200 select-all">{createdLiveDetails.rtmpUrl}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Clave de emisión (Stream Key):</span>
                  <span className="text-amber-400 font-bold select-all">{createdLiveDetails.streamName}</span>
                </div>
              </div>
            </div>
          )}

          {loadingBroadcasts ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-red-500" />
              <span>Cargando transmisiones en directo...</span>
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500 text-xs">
              No hay transmisiones en directo programadas actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {broadcasts.map((bc) => (
                <div key={bc.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">{bc.title}</h3>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 uppercase">
                      {bc.lifeCycleStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Inicio: {new Date(bc.scheduledStartTime).toLocaleString('es-ES')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: UPLOAD NEW VIDEO */}
      {activeTab === 'upload' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-400" />
              Detalles del Nuevo Vídeo
            </h2>
            {videoFile && (
              <button
                onClick={resetForm}
                disabled={uploading}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Limpiar formulario
              </button>
            )}
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Archivo de Vídeo <span className="text-red-400">*</span>
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => videoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : videoFile
                    ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-950/40'
                }`}
              >
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleVideoSelect(e.target.files[0])}
                />
                {videoFile ? (
                  <div className="flex items-center gap-3 text-emerald-400">
                    <FileVideo className="w-8 h-8" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-zinc-100 truncate max-w-md">
                        {videoFile.name}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono">
                        {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • {videoFile.type || 'video'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                      <UploadCloud className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        Arrastra y suelta tu vídeo aquí, o <span className="text-indigo-400 underline">examina tus archivos</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Título del Vídeo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ej. Veredillas FM #42 - Entrevista con invitado especial"
                  required
                  maxLength={100}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Resumen del episodio..."
                  rows={4}
                  maxLength={5000}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Visibilidad</label>
                <select
                  value={privacyStatus}
                  onChange={(e: any) => setPrivacyStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="unlisted">Oculto</option>
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Categoría</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Etiquetas</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="podcast, veredillas fm"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="md:col-span-2 border-t border-zinc-800/80 pt-4">
                <label className="block text-xs font-medium text-zinc-300 mb-2">Miniatura (Recortador 16:9)</label>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="w-48 h-28 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg bg-zinc-950/60 flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0 relative group"
                  >
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleThumbnailSelect(e.target.files[0])}
                    />
                    {thumbnailPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnailPreview} alt="Miniatura previa" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2 text-zinc-500 group-hover:text-zinc-300 transition">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 text-zinc-600 group-hover:text-indigo-400" />
                        <span className="text-[11px]">Subir e interactuar (JPG/PNG)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="bg-zinc-950 border border-indigo-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-300 font-medium flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    {statusMessage}
                  </span>
                  <span className="font-mono text-indigo-400 font-bold text-sm">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-red-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadedVideoId && (
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200">¡Vídeo subido a YouTube!</h3>
                    <p className="text-xs text-zinc-400 font-mono">{uploadedVideoId}</p>
                  </div>
                </div>
                <a
                  href={`https://youtu.be/${uploadedVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold"
                >
                  Ver en YouTube
                </a>
              </div>
            )}

            <div className="flex items-center justify-end border-t border-zinc-800 pt-5">
              <button
                type="submit"
                disabled={uploading || !videoFile || !configured}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                Subir Vídeo a YouTube
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE & EDIT PLAYLIST MODAL */}
      {createPlaylistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingPlaylist ? 'Editar Lista de Reproducción' : 'Nueva Lista de Reproducción'}
              </h3>
              <button onClick={() => setCreatePlaylistOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePlaylist} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Título de la Playlist</label>
                <input
                  type="text"
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Descripción</label>
                <textarea
                  value={playlistDesc}
                  onChange={(e) => setPlaylistDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Visibilidad</label>
                <select
                  value={playlistPrivacy}
                  onChange={(e: any) => setPlaylistPrivacy(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                >
                  <option value="public">Pública</option>
                  <option value="unlisted">Oculta</option>
                  <option value="private">Privada</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreatePlaylistOpen(false)} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPlaylist} className="px-4 py-2 bg-indigo-600 text-xs text-white rounded-lg font-semibold">
                  {savingPlaylist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD VIDEO TO PLAYLIST MODAL */}
      {addToPlaylistVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-400" /> Añadir Vídeo a Playlist
              </h3>
              <button onClick={() => setAddToPlaylistVideo(null)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 truncate">
              Vídeo: <strong>"{addToPlaylistVideo.title}"</strong>
            </p>

            <form onSubmit={handleAddToPlaylistSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Selecciona una Lista de Reproducción</label>
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Elige una playlist --</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.title} ({pl.itemCount} vídeos)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button type="button" onClick={() => setAddToPlaylistVideo(null)} className="px-4 py-2 bg-zinc-800 text-xs text-zinc-300 rounded-lg">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingToPlaylist || !selectedPlaylistId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs text-white rounded-lg font-semibold transition"
                >
                  {addingToPlaylist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Añadir a Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE LIVE MODAL */}
      {scheduleLiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">Programar Emisión en Directo (RTMP)</h3>
              <button onClick={() => setScheduleLiveOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleLive} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Título del Directo</label>
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  required
                  placeholder="ej. Veredillas FM En Vivo - Programa Especial"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Fecha y Hora de Inicio</label>
                <input
                  type="datetime-local"
                  value={liveStartTime}
                  onChange={(e) => setLiveStartTime(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setScheduleLiveOpen(false)} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={schedulingLive} className="px-4 py-2 bg-red-600 text-xs text-white rounded-lg font-semibold">
                  {schedulingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Programar y Generar Claves
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VIDEO MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">Editar Vídeo</h3>
              <button onClick={() => setEditingVideo(null)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Título</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Descripción</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Visibilidad</label>
                <select
                  value={editPrivacy}
                  onChange={(e: any) => setEditPrivacy(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                >
                  <option value="public">Público</option>
                  <option value="unlisted">Oculto</option>
                  <option value="private">Privado</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingVideo(null)} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={savingEdit} className="px-4 py-2 bg-indigo-600 text-xs text-white rounded-lg font-semibold">
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE VIDEO MODAL */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-red-900/50 rounded-2xl w-full max-w-md p-6 space-y-4 text-center">
            <h3 className="text-base font-bold text-zinc-100">¿Eliminar vídeo de YouTube?</h3>
            <p className="text-xs text-zinc-400">Esta acción eliminará "{deletingVideo.title}" de tu canal.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setDeletingVideo(null)} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg">
                Cancelar
              </button>
              <button onClick={handleDeleteVideo} disabled={deleting} className="px-4 py-2 bg-red-600 text-xs text-white rounded-lg font-semibold">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CROPPER MODAL */}
      {cropperOpen && cropperSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Recortar Miniatura (16:9)</h3>
              <button onClick={() => setCropperOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-5">
              <div
                ref={cropperContainerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full aspect-video relative overflow-hidden bg-zinc-950 border border-zinc-800 rounded-xl cursor-move select-none"
              >
                <div className="absolute inset-0 border-2 border-indigo-500/40 pointer-events-none z-10 rounded-xl m-0.5" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={cropperImageRef}
                  src={cropperSrc}
                  alt="Crop preview"
                  onMouseDown={handleMouseDown}
                  draggable={false}
                  className="absolute max-w-none select-none origin-center"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    maxHeight: '100%',
                  }}
                />
              </div>
              <div className="w-full space-y-1.5">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-3">
              <button onClick={() => setCropperOpen(false)} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg">
                Cancelar
              </button>
              <button onClick={handleCropSave} className="px-4 py-2 bg-indigo-600 text-xs text-white rounded-lg font-semibold">
                Recortar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
