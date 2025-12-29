import React, { useState, useEffect, useCallback } from 'react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useFeaturedProfiles } from '../hooks/useFeaturedProfiles'
import { 
  UserPlus, 
  Users, 
  TrendingUp, 
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  ExternalLink
} from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'

const SUBSCRIPTION_OPTIONS = {
  daily: { 
    label: 'Daily', 
    price: '0.2 USDC', 
    days: 1,
    description: 'Featured for 1 day'
  },
  weekly: { 
    label: 'Weekly', 
    price: '1.0 USDC', 
    days: 7,
    description: 'Featured for 7 days'
  },
  monthly: { 
    label: 'Monthly', 
    price: '6.0 USDC', 
    days: 30,
    description: 'Featured for 30 days'
  }
}

export default function FeaturedProfiles() {
  const { user, isInFarcaster, sdk, isReady } = useFarcaster()
  const { 
    registerProfile, 
    getFeaturedProfiles, 
    followUser, 
    unfollowUser,
    checkFollowStatus,
    isLoading,
    error 
  } = useFeaturedProfiles()

  const [profiles, setProfiles] = useState([])
  const [selectedSubscription, setSelectedSubscription] = useState('daily')
  const [description, setDescription] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [followStatuses, setFollowStatuses] = useState({}) // { fid: { is_following, is_mutual } }
  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  // Update currentUser when user changes
  useEffect(() => {
    if (user) {
      setCurrentUser(user)
    }
  }, [user])

  // Try to load user if not available (single check, no polling)
  // sdk.context is a Promise, must await it
  useEffect(() => {
    if (!isInFarcaster || !isReady || currentUser) return

    const loadUser = async () => {
      setIsLoadingUser(true)
      try {
        const context = await sdk.context
        if (context?.user && context.user.fid) {
          console.log('✅ User loaded from SDK:', context.user)
          setCurrentUser(context.user)
        } else {
          console.log('⚠️ User context not available')
        }
      } catch (err) {
        console.error('❌ Error loading user:', err)
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()
  }, [isInFarcaster, isReady, currentUser, sdk])

  useEffect(() => {
    loadProfiles()
  }, [])

  // Check if current user already has an active profile
  const currentUserProfile = profiles.find(p => p.farcaster_fid === currentUser?.fid)
  const hasActiveProfile = currentUserProfile && 
    currentUserProfile.is_active && 
    new Date(currentUserProfile.expires_at) > new Date()

  const loadProfiles = async () => {
    const data = await getFeaturedProfiles()
    setProfiles(data)
  }

  // Memoize checkAllFollowStatuses to avoid closure issues
  const checkAllFollowStatuses = useCallback(async () => {
    // Use currentUser?.fid or user?.fid - whichever is available
    const currentFid = currentUser?.fid || user?.fid
    
    if (!currentFid || profiles.length === 0) {
      console.log('⏭️ Skipping follow status check:', { 
        hasUser: !!user, 
        hasCurrentUser: !!currentUser,
        userFid: user?.fid,
        currentUserFid: currentUser?.fid,
        currentFid,
        profilesCount: profiles.length 
      })
      return
    }
    
    console.log('🔄 Checking follow statuses for all profiles...', {
      currentFid,
      userFid: user?.fid,
      currentUserFid: currentUser?.fid,
      profilesCount: profiles.length,
      profileFids: profiles.map(p => p.farcaster_fid)
    })
    const statuses = {}
    
    // Check all profiles in parallel for better performance
    const statusPromises = profiles.map(async (profile) => {
      try {
        const status = await checkFollowStatus(profile.farcaster_fid)
        console.log(`✅ Status for ${profile.farcaster_fid}:`, status)
        return { fid: profile.farcaster_fid, status }
      } catch (err) {
        console.error(`❌ Error checking status for ${profile.farcaster_fid}:`, err)
        return { fid: profile.farcaster_fid, status: { is_following: false, is_mutual: false } }
      }
    })
    
    const results = await Promise.all(statusPromises)
    results.forEach(({ fid, status }) => {
      statuses[fid] = status
    })
    
    console.log('✅ Follow statuses updated:', statuses)
    setFollowStatuses(prevStatuses => {
      console.log('🔄 setFollowStatuses - prev:', prevStatuses, 'new:', statuses)
      return statuses
    })
    console.log('✅ setFollowStatuses called with:', statuses)
  }, [profiles, user?.fid, currentUser?.fid, checkFollowStatus])

  useEffect(() => {
    // Check follow statuses for all profiles
    if (profiles.length > 0 && (user?.fid || currentUser?.fid)) {
      console.log('🚀 Triggering follow status check...', {
        userFid: user?.fid,
        currentUserFid: currentUser?.fid,
        profilesCount: profiles.length
      })
      checkAllFollowStatuses()
      
      // Also check periodically to catch Farcaster-side follows
      const interval = setInterval(() => {
        console.log('⏰ Periodic follow status check...')
        checkAllFollowStatuses()
      }, 5000) // Check every 5 seconds
      
      return () => {
        console.log('🧹 Cleaning up follow status check interval')
        clearInterval(interval)
      }
    } else {
      console.log('⏭️ Not checking follow status:', {
        profilesCount: profiles.length,
        userFid: user?.fid,
        currentUserFid: currentUser?.fid
      })
    }
  }, [profiles, user?.fid, currentUser?.fid, checkAllFollowStatuses])

  const handleRegister = async () => {
    if (!isInFarcaster || !currentUser) {
      alert('Please connect your Farcaster account')
      return
    }

    setIsRegistering(true)
    try {
      await registerProfile(
        { description: description.trim() || '' },
        selectedSubscription
      )
      alert('Profile registered successfully! You are now at the top of the list!')
      setShowRegisterForm(false)
      setDescription('')
      loadProfiles()
    } catch (err) {
      alert('Registration failed: ' + err.message)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleFollow = async (profileFid, profileUsername) => {
    if (!user?.fid) {
      alert('Please connect your Farcaster account')
      return
    }

    const currentStatus = followStatuses[profileFid]
    const wasFollowing = currentStatus?.is_following || false

    // If already following, unfollow instead
    if (wasFollowing) {
      try {
        // Optimistic update
        setFollowStatuses(prev => ({
          ...prev,
          [profileFid]: { is_following: false, is_mutual: false }
        }))
        
        await unfollowUser(profileFid)
        setFollowStatuses(prev => ({
          ...prev,
          [profileFid]: { is_following: false, is_mutual: false }
        }))
        
        // Refresh profiles to update counts
        loadProfiles()
      } catch (err) {
        // Revert optimistic update on error
        setFollowStatuses(prev => ({
          ...prev,
          [profileFid]: currentStatus
        }))
        console.error('Unfollow error:', err)
        alert('Failed to unfollow. Please try again.')
      }
      return
    }

    // Optimistic update: Assume user will follow, update UI immediately
    setFollowStatuses(prev => ({
      ...prev,
      [profileFid]: { is_following: true, is_mutual: false }
    }))

    // Try to use Farcaster native viewProfile action first (better UX)
    try {
      if (sdk?.actions?.viewProfile) {
        console.log('📱 Opening profile with Farcaster viewProfile:', profileFid)
        
        // Immediately try to sync with DB (optimistic)
        followUser(profileFid).then(result => {
          console.log('✅ Follow synced to DB:', result)
          setFollowStatuses(prev => ({
            ...prev,
            [profileFid]: { 
              is_following: true, 
              is_mutual: result.is_mutual || false 
            }
          }))
          
          if (result.is_mutual) {
            setTimeout(() => {
              alert('🎉 Mutual follow! You are now following each other!')
            }, 500)
          }
          
          // Refresh profiles to update counts
          loadProfiles()
        }).catch(syncErr => {
          // If already following, that's fine - just update status
          if (syncErr.message && syncErr.message.includes('Already following')) {
            console.log('Already following in DB, updating status')
            setFollowStatuses(prev => ({
              ...prev,
              [profileFid]: { is_following: true, is_mutual: false }
            }))
          } else {
            console.log('Initial sync error (will retry):', syncErr.message)
          }
        })
        
        // Open profile
        await sdk.actions.viewProfile({ fid: profileFid })
        
        // After viewProfile closes, immediately check and sync status
        // This handles the case where user follows in Farcaster but our DB doesn't know
        console.log('📱 viewProfile closed, checking follow status...')
        
        // Immediate check
        try {
          const newStatus = await checkFollowStatus(profileFid)
          console.log('🔄 Immediate follow status check:', { profileFid, newStatus })
          
          // If user is now following (either in our DB or just followed in Farcaster)
          if (newStatus.is_following) {
            // Update state
            setFollowStatuses(prev => ({
              ...prev,
              [profileFid]: newStatus
            }))
            
            // Try to sync with our DB (may already exist, that's ok)
            try {
              const result = await followUser(profileFid)
              console.log('✅ Follow synced to DB after viewProfile:', result)
              setFollowStatuses(prev => ({
                ...prev,
                [profileFid]: { 
                  is_following: true, 
                  is_mutual: result.is_mutual || false 
                }
              }))
              
              if (result.is_mutual) {
                setTimeout(() => {
                  alert('🎉 Mutual follow! You are now following each other!')
                }, 500)
              }
            } catch (syncErr) {
              // If already following, that's fine - just update status
              if (syncErr.message && syncErr.message.includes('Already following')) {
                console.log('Already following in DB, updating status')
                setFollowStatuses(prev => ({
                  ...prev,
                  [profileFid]: { is_following: true, is_mutual: false }
                }))
              } else {
                console.log('Sync error (non-critical):', syncErr.message)
              }
            }
            
            // Refresh profiles to update counts
            loadProfiles()
          } else {
            // Not following - check a few more times in case there's a delay
            let checkCount = 0
            const maxChecks = 10 // Check for 5 seconds (10 * 500ms)
            
            const checkInterval = setInterval(async () => {
              checkCount++
              try {
                const retryStatus = await checkFollowStatus(profileFid)
                console.log('🔄 Retry follow status check:', { profileFid, retryStatus, checkCount })
                
                if (retryStatus.is_following) {
                  clearInterval(checkInterval)
                  
                  // Update state
                  setFollowStatuses(prev => ({
                    ...prev,
                    [profileFid]: retryStatus
                  }))
                  
                  // Try to sync with our DB
                  try {
                    const result = await followUser(profileFid)
                    setFollowStatuses(prev => ({
                      ...prev,
                      [profileFid]: { 
                        is_following: true, 
                        is_mutual: result.is_mutual || false 
                      }
                    }))
                    
                    if (result.is_mutual) {
                      setTimeout(() => {
                        alert('🎉 Mutual follow! You are now following each other!')
                      }, 500)
                    }
                  } catch (syncErr) {
                    if (syncErr.message && syncErr.message.includes('Already following')) {
                      setFollowStatuses(prev => ({
                        ...prev,
                        [profileFid]: { is_following: true, is_mutual: false }
                      }))
                    }
                  }
                  
                  // Refresh profiles to update counts
                  loadProfiles()
                } else if (checkCount >= maxChecks) {
                  clearInterval(checkInterval)
                  console.log('⏱️ Stopped checking follow status after max attempts')
                }
              } catch (checkErr) {
                console.error('Error checking follow status:', checkErr)
                if (checkCount >= maxChecks) {
                  clearInterval(checkInterval)
                }
              }
            }, 500) // Check every 500ms
          }
        } catch (checkErr) {
          console.error('Error in immediate follow status check:', checkErr)
        }
      } else {
        // Fallback to Warpcast URL if viewProfile not available
        console.log('⚠️ viewProfile not available, using Warpcast URL fallback')
        const warpcastUrl = profileUsername 
          ? `https://warpcast.com/${profileUsername}`
          : `https://warpcast.com/~/profile/${profileFid}`
        window.open(warpcastUrl, '_blank', 'noopener,noreferrer')
        
        // For Warpcast URL, check status periodically
        const checkInterval = setInterval(async () => {
          try {
            const newStatus = await checkFollowStatus(profileFid)
            if (newStatus.is_following !== wasFollowing) {
              clearInterval(checkInterval)
              setFollowStatuses(prev => ({
                ...prev,
                [profileFid]: newStatus
              }))
              await syncFollowStatus(profileFid, wasFollowing)
            }
          } catch (err) {
            console.error('Status check error:', err)
          }
        }, 2000)
        
        setTimeout(() => clearInterval(checkInterval), 30000)
      }
    } catch (err) {
      // Fallback to Warpcast URL on error
      console.error('❌ Error opening profile with viewProfile:', err)
      const warpcastUrl = profileUsername 
        ? `https://warpcast.com/${profileUsername}`
        : `https://warpcast.com/~/profile/${profileFid}`
      window.open(warpcastUrl, '_blank', 'noopener,noreferrer')
      
      // For fallback, check status periodically
      const checkInterval = setInterval(async () => {
        try {
          const newStatus = await checkFollowStatus(profileFid)
          if (newStatus.is_following !== wasFollowing) {
            clearInterval(checkInterval)
            setFollowStatuses(prev => ({
              ...prev,
              [profileFid]: newStatus
            }))
            await syncFollowStatus(profileFid, wasFollowing)
          }
        } catch (checkErr) {
          console.error('Status check error:', checkErr)
        }
      }, 2000)
      
      setTimeout(() => clearInterval(checkInterval), 30000)
    }

    // Also try to update our database immediately (optimistic update)
    if (!wasFollowing) {
      try {
        await syncFollowStatus(profileFid, wasFollowing)
      } catch (err) {
        // Non-critical, will be checked later
        console.log('Initial sync failed (will retry):', err.message)
      }
    }
  }

  // Helper function to sync follow status with database
  const syncFollowStatus = async (profileFid, wasFollowing) => {
    try {
      const currentStatus = followStatuses[profileFid]
      const isCurrentlyFollowing = currentStatus?.is_following || false
      
      // If status changed, sync with DB
      if (isCurrentlyFollowing && !wasFollowing) {
        // User started following - sync to DB
        try {
          const result = await followUser(profileFid)
          setFollowStatuses(prev => ({
            ...prev,
            [profileFid]: { 
              is_following: true, 
              is_mutual: result.is_mutual || false 
            }
          }))
          
          if (result.is_mutual) {
            setTimeout(() => {
              alert('🎉 Mutual follow! You are now following each other!')
            }, 500)
          }
        } catch (followErr) {
          // If "Already following" error, just update status silently
          if (followErr.message && followErr.message.includes('Already following')) {
            setFollowStatuses(prev => ({
              ...prev,
              [profileFid]: { is_following: true, is_mutual: false }
            }))
          } else {
            console.log('Follow in DB failed (non-critical):', followErr.message)
          }
        }
      } else if (!isCurrentlyFollowing && wasFollowing) {
        // User stopped following - sync to DB
        try {
          await unfollowUser(profileFid)
          setFollowStatuses(prev => ({
            ...prev,
            [profileFid]: { is_following: false, is_mutual: false }
          }))
        } catch (unfollowErr) {
          console.log('Unfollow in DB failed (non-critical):', unfollowErr.message)
        }
      }
      
      // Refresh profiles to update counts
      loadProfiles()
    } catch (err) {
      console.error('Database sync failed (non-critical):', err)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getDaysRemaining = (expiresAt) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires - now
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 0
  }

  // Farcaster-only guard for web users
  if (!isInFarcaster) {
    return (
      <div className="card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <BackButton />
        
        <div style={{
          background: 'rgba(30, 41, 59, 0.95)',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center',
          border: '2px solid rgba(251, 191, 36, 0.2)',
          marginTop: '32px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(251, 191, 36, 0.3)'
          }}>
            <Star size={40} style={{ color: 'white' }} />
          </div>
          
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#e5e7eb', 
            marginBottom: '16px' 
          }}>
            Featured Profiles
          </h1>
          
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
              <h2 style={{ 
                color: '#ef4444', 
                fontSize: '20px', 
                fontWeight: 'bold',
                margin: 0
              }}>
                Bu Özellik Sadece Farcaster Mini App İçin Yapılmıştır
              </h2>
            </div>
            <p style={{ 
              color: '#9ca3af', 
              fontSize: '16px', 
              marginBottom: '24px',
              lineHeight: '1.6',
              marginTop: '8px'
            }}>
              Featured Profiles özelliğini kullanmak için lütfen Farcaster Mini App'i açın. Bu özellik Warpcast, Farcord gibi Farcaster istemcilerinde çalışmaktadır.
            </p>
            
            <a
              href="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: 'white',
                padding: '18px 36px',
                borderRadius: '12px',
                fontSize: '20px',
                fontWeight: '700',
                textDecoration: 'none',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)',
                width: '100%',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)'
              }}
            >
              <ExternalLink size={24} />
              Farcaster Mini App'i Aç
            </a>
            
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px'
            }}>
              <p style={{ 
                color: '#9ca3af', 
                fontSize: '14px', 
                margin: 0,
                textAlign: 'center'
              }}>
                <strong style={{ color: '#e5e7eb' }}>Nasıl Açılır?</strong><br />
                Warpcast, Farcord veya diğer Farcaster istemcilerinde BaseHub uygulamasını açın, 
                ardından <strong style={{ color: '#fbbf24' }}>SOCIAL</strong> kategorisinden 
                <strong style={{ color: '#fbbf24' }}> Featured Profiles</strong> özelliğine erişebilirsiniz.
              </p>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '32px',
            textAlign: 'left',
            maxWidth: '600px',
            margin: '32px auto 0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '12px'
            }}>
              <CheckCircle size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: '#e5e7eb', margin: 0, fontWeight: '600', marginBottom: '4px' }}>
                  Profil Kaydı
                </p>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                  Profilinizi kaydedin ve listenin en üstünde görünün
                </p>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '12px'
            }}>
              <CheckCircle size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: '#e5e7eb', margin: 0, fontWeight: '600', marginBottom: '4px' }}>
                  Karşılıklı Takip
                </p>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                  Diğer kullanıcılarla karşılıklı takip yapın ve topluluk oluşturun
                </p>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '12px'
            }}>
              <CheckCircle size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: '#e5e7eb', margin: 0, fontWeight: '600', marginBottom: '4px' }}>
                  Esnek Fiyatlandırma
                </p>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                  Günlük (0.2 USDC), Haftalık (1.0 USDC) veya Aylık (6.0 USDC) seçenekleri
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard>
      <div className="card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <BackButton />
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Star size={32} style={{ color: '#fbbf24' }} />
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#e5e7eb' }}>
              Featured Profiles
            </h1>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            Register your profile to appear at the top of the list. Connect with others through mutual follows!
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#ef4444'
          }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Register Profile Section */}
        {isInFarcaster && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px'
          }}>
            {isLoadingUser ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#9ca3af'
              }}>
                <Loader2 size={32} className="spin" style={{ marginBottom: '16px', color: '#fbbf24' }} />
                <p style={{ margin: 0 }}>Loading your profile...</p>
              </div>
            ) : currentUser && currentUser.fid ? (
              <>
                {/* User Profile Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(251, 191, 36, 0.2)'
                }}>
                  <img 
                    src={currentUser?.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.fid || 'default'}`} 
                    alt={currentUser?.displayName || currentUser?.username || 'User'} 
                    onError={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.fid || 'default'}`
                    }}
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '2px solid #fbbf24'
                    }} 
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: 0, 
                      color: '#e5e7eb', 
                      fontWeight: 'bold', 
                      fontSize: '18px' 
                    }}>
                      {currentUser?.displayName || currentUser?.username || `User ${currentUser?.fid || ''}`}
                    </p>
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      color: '#9ca3af', 
                      fontSize: '14px' 
                    }}>
                      @{currentUser?.username || `fid-${currentUser?.fid || ''}`}
                    </p>
                    {currentUser?.bio && (
                      <p style={{ 
                        margin: '8px 0 0 0', 
                        color: '#9ca3af', 
                        fontSize: '13px',
                        fontStyle: 'italic'
                      }}>
                        {currentUser.bio}
                      </p>
                    )}
                  </div>
                </div>

                {hasActiveProfile ? (
                  <div style={{
                    width: '100%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                      <CheckCircle size={20} style={{ color: '#10b981' }} />
                      <p style={{ margin: 0, color: '#10b981', fontWeight: '600', fontSize: '16px' }}>
                        Profile Already Active!
                      </p>
                    </div>
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
                      Your profile expires in {getDaysRemaining(currentUserProfile.expires_at)} day(s)
                    </p>
                    <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '12px' }}>
                      You can register again after it expires.
                    </p>
                  </div>
                ) : !showRegisterForm ? (
                  <button
                    onClick={() => setShowRegisterForm(true)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '16px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)'
                    }}
                  >
                    <Star size={20} />
                    Register Your Profile
                  </button>
                ) : (
                  <div>
                    <h3 style={{ color: '#e5e7eb', marginBottom: '20px' }}>
                      Register Your Profile
                    </h3>

                    {/* Subscription Type Selection */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ 
                        color: '#9ca3af', 
                        fontSize: '14px', 
                        marginBottom: '8px',
                        display: 'block'
                      }}>
                        Select Duration
                      </label>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '12px' 
                      }}>
                        {Object.entries(SUBSCRIPTION_OPTIONS).map(([key, option]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedSubscription(key)}
                            style={{
                              padding: '16px',
                              borderRadius: '12px',
                              border: selectedSubscription === key 
                                ? '2px solid #fbbf24' 
                                : '2px solid rgba(255, 255, 255, 0.1)',
                              background: selectedSubscription === key
                                ? 'rgba(251, 191, 36, 0.1)'
                                : 'rgba(30, 41, 59, 0.6)',
                              color: '#e5e7eb',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                              {option.label}
                            </div>
                            <div style={{ fontSize: '18px', color: '#fbbf24', marginBottom: '4px' }}>
                              {option.price}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {option.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description Input */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ 
                        color: '#9ca3af', 
                        fontSize: '14px', 
                        marginBottom: '8px',
                        display: 'block'
                      }}>
                        Description (About Mutual Follows) <span style={{ color: '#6b7280', fontSize: '12px' }}>(Optional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write a short description about why people should follow you and how mutual follows work..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e5e7eb',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                      <p style={{ 
                        color: '#6b7280', 
                        fontSize: '12px', 
                        marginTop: '4px',
                        marginBottom: 0
                      }}>
                        Example: "Mutual follows welcome! Let's connect and grow together." (Optional - leave blank if you prefer)
                      </p>
                    </div>

                    {/* Register Button */}
                    <button
                      onClick={handleRegister}
                      disabled={isRegistering || isLoading}
                      style={{
                        width: '100%',
                        background: isRegistering || isLoading
                          ? 'rgba(251, 191, 36, 0.3)'
                          : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '16px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: isRegistering || isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        boxShadow: isRegistering || isLoading
                          ? 'none'
                          : '0 4px 12px rgba(251, 191, 36, 0.3)'
                      }}
                    >
                      {isRegistering || isLoading ? (
                        <>
                          <Loader2 size={20} className="spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          <Star size={20} />
                          Register for {SUBSCRIPTION_OPTIONS[selectedSubscription].price}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setShowRegisterForm(false)
                        setDescription('')
                      }}
                      style={{
                        width: '100%',
                        marginTop: '12px',
                        background: 'transparent',
                        color: '#9ca3af',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '12px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#9ca3af'
              }}>
                <AlertCircle size={32} style={{ marginBottom: '16px', color: '#f59e0b' }} />
                <p style={{ margin: 0, marginBottom: '12px', fontWeight: '600' }}>
                  Could not load your profile
                </p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Please make sure you're logged into Farcaster and try refreshing the page.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Profiles List */}
        <div>
          <h2 style={{ 
            color: '#e5e7eb', 
            fontSize: '20px', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Users size={20} />
            Featured Profiles ({profiles.length})
          </h2>

          {profiles.length === 0 ? (
            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <Star size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
              <p style={{ margin: 0 }}>No featured profiles yet. Be the first to register!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {profiles.map((profile, index) => {
                const status = followStatuses[profile.farcaster_fid] || { 
                  is_following: false, 
                  is_mutual: false 
                }
                const daysRemaining = getDaysRemaining(profile.expires_at)
                
                // Debug: Log profile and status for all profiles
                console.log(`🔍 Profile ${index + 1} debug:`, {
                  profileFid: profile.farcaster_fid,
                  profileUsername: profile.username,
                  userFid: user?.fid,
                  status,
                  statusFromState: followStatuses[profile.farcaster_fid],
                  hasUser: !!user,
                  isInFarcaster,
                  allFollowStatuses: followStatuses
                })

                return (
                  <div
                    key={profile.id}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: index === 0 
                        ? '2px solid #fbbf24' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      padding: '24px',
                      position: 'relative'
                    }}
                  >
                    {index === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        #1 TOP
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      {/* Avatar */}
                      <img
                        src={profile.avatar_url || '/default-avatar.png'}
                        alt={profile.display_name}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: '2px solid rgba(255, 255, 255, 0.1)'
                        }}
                      />

                      {/* Profile Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          marginBottom: '8px'
                        }}>
                          <h3 style={{ 
                            color: '#e5e7eb', 
                            fontSize: '18px', 
                            fontWeight: '700',
                            margin: 0
                          }}>
                            {profile.display_name || 'Unknown'}
                          </h3>
                          {status.is_mutual && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              color: '#10b981',
                              fontWeight: '600'
                            }}>
                              <CheckCircle size={12} />
                              Mutual
                            </div>
                          )}
                        </div>

                        <p style={{ 
                          color: '#9ca3af', 
                          fontSize: '14px', 
                          margin: '0 0 8px 0'
                        }}>
                          @{profile.username || 'unknown'}
                        </p>

                        {profile.description && (
                          <p style={{ 
                            color: '#e5e7eb', 
                            fontSize: '14px', 
                            margin: '0 0 12px 0',
                            lineHeight: '1.5'
                          }}>
                            {profile.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div style={{ 
                          display: 'flex', 
                          gap: '16px', 
                          marginBottom: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={16} style={{ color: '#9ca3af' }} />
                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                              {profile.followers_count} Followers
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={16} style={{ color: '#10b981' }} />
                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                              {profile.mutual_follows_count} Mutual
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={16} style={{ color: '#9ca3af' }} />
                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                              {daysRemaining} days left
                            </span>
                          </div>
                        </div>

                        {/* Follow Button - Always show if not own profile */}
                        {user?.fid === profile.farcaster_fid ? (
                          <div style={{
                            padding: '8px 16px',
                            background: 'rgba(251, 191, 36, 0.1)',
                            borderRadius: '8px',
                            color: '#fbbf24',
                            fontSize: '14px',
                            textAlign: 'center',
                            border: '1px solid rgba(251, 191, 36, 0.3)'
                          }}>
                            Your Profile
                          </div>
                        ) : (
                          <button
                            onClick={() => handleFollow(profile.farcaster_fid, profile.username)}
                            style={{
                              background: status?.is_following
                                ? 'rgba(30, 41, 59, 0.6)'
                                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: 'white',
                              border: status?.is_following
                                ? '1px solid rgba(255, 255, 255, 0.1)'
                                : 'none',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              width: '100%',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (!status?.is_following) {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            {status?.is_following ? (
                              <>
                                <CheckCircle size={16} />
                                Following
                              </>
                            ) : (
                              <>
                                <UserPlus size={16} />
                                Follow on Farcaster
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    </NetworkGuard>
  )
}

