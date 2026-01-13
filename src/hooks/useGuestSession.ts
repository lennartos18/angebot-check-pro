import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'angebots_check_session_token';
const SESSION_EXPIRY_HOURS = 24;

export interface GuestDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'analyzed' | 'error';
  analysisResult?: any;
}

export interface GuestSession {
  id: string;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
  documents: GuestDocument[];
  analysisJson?: any;
  plz?: string;
  stadt?: string;
}

export function useGuestSession() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate or retrieve session token
  const getOrCreateToken = useCallback((): string => {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  }, []);

  // Load or create session
  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getOrCreateToken();

      // Try to fetch existing session
      const { data: existingSession, error: fetchError } = await supabase
        .from('guest_sessions')
        .select('*')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching session:', fetchError);
        throw fetchError;
      }

      if (existingSession) {
        const docsJson = existingSession.documents_json;
        const documents: GuestDocument[] = Array.isArray(docsJson) 
          ? (docsJson as unknown as GuestDocument[]) 
          : [];
        
        setSession({
          id: existingSession.id,
          sessionToken: existingSession.session_token,
          createdAt: existingSession.created_at || '',
          expiresAt: existingSession.expires_at || '',
          documents,
          analysisJson: existingSession.analysis_json,
          plz: existingSession.plz || undefined,
          stadt: existingSession.stadt || undefined,
        });
      } else {
        // Create new session
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

        const { data: newSession, error: createError } = await supabase
          .from('guest_sessions')
          .insert({
            session_token: token,
            expires_at: expiresAt.toISOString(),
            documents_json: [],
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating session:', createError);
          throw createError;
        }

        setSession({
          id: newSession.id,
          sessionToken: newSession.session_token,
          createdAt: newSession.created_at || '',
          expiresAt: newSession.expires_at || '',
          documents: [],
          plz: undefined,
          stadt: undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session-Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [getOrCreateToken]);

  // Update session documents
  const updateDocuments = useCallback(async (documents: GuestDocument[]) => {
    if (!session) return;

    try {
      const { error: updateError } = await supabase
        .from('guest_sessions')
        .update({ documents_json: documents as any })
        .eq('id', session.id);

      if (updateError) throw updateError;

      setSession(prev => prev ? { ...prev, documents } : null);
    } catch (err) {
      console.error('Error updating documents:', err);
      setError(err instanceof Error ? err.message : 'Update-Fehler');
    }
  }, [session]);

  // Update analysis result
  const updateAnalysis = useCallback(async (analysisJson: any) => {
    if (!session) return;

    try {
      const { error: updateError } = await supabase
        .from('guest_sessions')
        .update({ analysis_json: analysisJson })
        .eq('id', session.id);

      if (updateError) throw updateError;

      setSession(prev => prev ? { ...prev, analysisJson } : null);
    } catch (err) {
      console.error('Error updating analysis:', err);
      setError(err instanceof Error ? err.message : 'Analyse-Update-Fehler');
    }
  }, [session]);

  // Update location
  const updateLocation = useCallback(async (plz?: string, stadt?: string) => {
    if (!session) return;

    try {
      const { error: updateError } = await supabase
        .from('guest_sessions')
        .update({ plz, stadt })
        .eq('id', session.id);

      if (updateError) throw updateError;

      setSession(prev => prev ? { ...prev, plz, stadt } : null);
    } catch (err) {
      console.error('Error updating location:', err);
    }
  }, [session]);

  // Add document to session
  const addDocument = useCallback(async (doc: GuestDocument) => {
    if (!session) return;
    
    const newDocs = [...session.documents, doc];
    await updateDocuments(newDocs);
  }, [session, updateDocuments]);

  // Remove document from session
  const removeDocument = useCallback(async (docId: string) => {
    if (!session) return;
    
    const newDocs = session.documents.filter(d => d.id !== docId);
    await updateDocuments(newDocs);
  }, [session, updateDocuments]);

  // Get time remaining
  const getTimeRemaining = useCallback((): string => {
    if (!session) return '';
    
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Abgelaufen';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }, [session]);

  // Clear session
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSession(null);
  }, []);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return {
    session,
    isLoading,
    error,
    addDocument,
    removeDocument,
    updateDocuments,
    updateAnalysis,
    updateLocation,
    getTimeRemaining,
    clearSession,
    reloadSession: loadSession,
  };
}
