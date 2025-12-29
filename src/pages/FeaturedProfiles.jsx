import React, { useState, useEffect } from 'react'
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
  Star
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
  const { user, isInFarcaster } = useFarcaster()
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

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    // Check follow statuses for all profiles
    if (profiles.length > 0 && user?.fid) {
      checkAllFollowStatuses()
    }
  }, [profiles, user?.fid])

  const loadProfiles = async () => {
    const data = await getFeaturedProfiles()
    setProfiles(data)
  }

  const checkAllFollowStatuses = async () => {
    const statuses = {}
    for (const profile of profiles) {
      const status = await checkFollowStatus(profile.farcaster_fid)
      statuses[profile.farcaster_fid] = status
    }
    setFollowStatuses(statuses)
  }

  const checkFollowStatus = async (fid) => {
    if (!user?.fid) return { is_following: false, is_mutual: false }
    
    try {
      const response = await fetch(`/api/follow/check/${user.fid}/${fid}`)
      const data = await response.json()
      return {
        is_following: data.is_following || false,
        is_mutual: data.is_mutual || false
      }
    } catch (err) {
      return { is_following: false, is_mutual: false }
    }
  }

  const handleRegister = async () => {
    if (!isInFarcaster || !user) {
      alert('Please connect your Farcaster account')
      return
    }

    if (!description.trim()) {
      alert('Please write a description about mutual follows')
      return
    }

    setIsRegistering(true)
    try {
      await registerProfile(
        { description: description.trim() },
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

  const handleFollow = async (profileFid) => {
    if (!user?.fid) {
      alert('Please connect your Farcaster account')
      return
    }

    try {
      const status = followStatuses[profileFid]
      if (status?.is_following) {
        await unfollowUser(profileFid)
        setFollowStatuses(prev => ({
          ...prev,
          [profileFid]: { is_following: false, is_mutual: false }
        }))
      } else {
        const result = await followUser(profileFid)
        setFollowStatuses(prev => ({
          ...prev,
          [profileFid]: { 
            is_following: true, 
            is_mutual: result.is_mutual || false 
          }
        }))
        
        if (result.is_mutual) {
          alert('🎉 Mutual follow! You are now following each other!')
        }
      }
      loadProfiles() // Refresh to update counts
    } catch (err) {
      alert('Failed to follow: ' + err.message)
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
        {isInFarcaster && user && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px'
          }}>
            {!showRegisterForm ? (
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
                  gap: '8px'
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
                    Description (About Mutual Follows) *
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
                    margin: 0
                  }}>
                    This description will be shown on your profile. Explain how mutual follows work!
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || !description.trim()}
                    style={{
                      flex: 1,
                      background: isRegistering || !description.trim()
                        ? 'rgba(251, 191, 36, 0.3)'
                        : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: isRegistering || !description.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Star size={18} />
                        Register ({SUBSCRIPTION_OPTIONS[selectedSubscription].price})
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowRegisterForm(false)
                      setDescription('')
                    }}
                    style={{
                      padding: '14px 24px',
                      background: 'rgba(30, 41, 59, 0.6)',
                      color: '#9ca3af',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
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

                        {/* Follow Button */}
                        {user?.fid && user.fid !== profile.farcaster_fid && (
                          <button
                            onClick={() => handleFollow(profile.farcaster_fid)}
                            style={{
                              background: status.is_following
                                ? 'rgba(30, 41, 59, 0.6)'
                                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: 'white',
                              border: status.is_following
                                ? '1px solid rgba(255, 255, 255, 0.1)'
                                : 'none',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {status.is_following ? (
                              <>
                                <CheckCircle size={16} />
                                Following
                              </>
                            ) : (
                              <>
                                <UserPlus size={16} />
                                Follow
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

