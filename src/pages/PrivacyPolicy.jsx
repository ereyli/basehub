import React from 'react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Shield, Lock, Eye, Database, Users, FileText } from 'lucide-react'

const PrivacyPolicy = () => {
  return (
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
      <BackButton />
      
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Shield size={32} style={{ color: '#3b82f6' }} />
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#e5e7eb' }}>
            Privacy Policy
          </h1>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div style={{ color: '#e5e7eb', lineHeight: '1.8' }}>
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} /> Introduction
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            Welcome to BaseHub ("we," "our," or "us"). We are committed to protecting your privacy and ensuring transparency about how we collect, use, and safeguard your information. This Privacy Policy explains our practices regarding data collection and usage when you use our platform.
          </p>
          <p style={{ color: '#9ca3af' }}>
            BaseHub is a gamified smart contracts platform built on the Base network, accessible as a Farcaster miniapp and web application. By using our services, you agree to the collection and use of information in accordance with this policy.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} /> Information We Collect
          </h2>
          
          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>1. Wallet Information</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            When you connect your wallet to BaseHub, we collect:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Your wallet address (public key)</li>
            <li>Transaction history on the Base network</li>
            <li>Network information (Base Mainnet/Base Sepolia)</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>2. Game and Activity Data</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We collect data related to your platform usage:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>XP (Experience Points) and level progression</li>
            <li>Game results and transaction outcomes</li>
            <li>Quest completion status</li>
            <li>Leaderboard rankings</li>
            <li>NFT minting activities</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>3. Farcaster Integration</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            When using BaseHub as a Farcaster miniapp:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Farcaster user ID (if available through SDK)</li>
            <li>Cast sharing context (when shared from Farcaster)</li>
            <li>Notification preferences</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>4. Technical Information</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We automatically collect certain technical information:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px' }}>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>IP address (for security and analytics)</li>
            <li>Usage patterns and interaction data</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} /> How We Use Your Information
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We use the collected information for the following purposes:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li><strong style={{ color: '#e5e7eb' }}>Platform Functionality:</strong> To enable games, XP tracking, leaderboards, and NFT minting</li>
            <li><strong style={{ color: '#e5e7eb' }}>Transaction Processing:</strong> To process blockchain transactions and record game results</li>
            <li><strong style={{ color: '#e5e7eb' }}>User Experience:</strong> To personalize your experience and improve our services</li>
            <li><strong style={{ color: '#e5e7eb' }}>Analytics:</strong> To understand usage patterns and enhance platform features</li>
            <li><strong style={{ color: '#e5e7eb' }}>Security:</strong> To detect and prevent fraud, abuse, and security threats</li>
            <li><strong style={{ color: '#e5e7eb' }}>Communication:</strong> To send notifications (via Farcaster SDK) about game results and achievements</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} /> Data Storage and Security
          </h2>
          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Supabase Database</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We use Supabase to store your data securely:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Player profiles (wallet address, XP, level)</li>
            <li>Transaction records</li>
            <li>Quest progress</li>
            <li>Leaderboard data</li>
          </ul>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            All data is encrypted in transit and at rest. We implement Row Level Security (RLS) policies to protect your data.
          </p>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Blockchain Data</h3>
          <p style={{ color: '#9ca3af' }}>
            Transaction data is stored on the Base blockchain, which is public and immutable. This includes game transactions, NFT minting, and token deployments.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} /> Data Sharing and Disclosure
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We do not sell your personal information. We may share data in the following circumstances:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li><strong style={{ color: '#e5e7eb' }}>Public Leaderboards:</strong> Your wallet address, XP, and level are displayed publicly on leaderboards</li>
            <li><strong style={{ color: '#e5e7eb' }}>Blockchain Transparency:</strong> All transactions are publicly visible on BaseScan</li>
            <li><strong style={{ color: '#e5e7eb' }}>Service Providers:</strong> We use Supabase for data storage and x402 for payment processing</li>
            <li><strong style={{ color: '#e5e7eb' }}>Legal Requirements:</strong> We may disclose data if required by law or to protect our rights</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Your Rights</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            You have the right to:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Access your data stored in our database</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account data (note: blockchain transactions cannot be deleted)</li>
            <li>Opt out of certain data collection (where technically feasible)</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            To exercise these rights, please contact us through our official channels.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Cookies and Tracking</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We use localStorage to store:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Wallet connection preferences</li>
            <li>Quest progress (as backup)</li>
            <li>User preferences</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            We do not use third-party cookies for advertising. Analytics data is collected anonymously.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Third-Party Services</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            BaseHub integrates with the following third-party services:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li><strong style={{ color: '#e5e7eb' }}>Supabase:</strong> Database and backend services</li>
            <li><strong style={{ color: '#e5e7eb' }}>x402 (Coinbase):</strong> Payment processing for premium features</li>
            <li><strong style={{ color: '#e5e7eb' }}>Farcaster SDK:</strong> Social features and notifications</li>
            <li><strong style={{ color: '#e5e7eb' }}>Pinata/IPFS:</strong> NFT metadata and image storage</li>
            <li><strong style={{ color: '#e5e7eb' }}>BaseScan:</strong> Blockchain explorer for transaction verification</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            These services have their own privacy policies. We encourage you to review them.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Children's Privacy</h2>
          <p style={{ color: '#9ca3af' }}>
            BaseHub is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Changes to This Privacy Policy</h2>
          <p style={{ color: '#9ca3af' }}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Contact Us</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px' }}>
            <li>Website: <a href="https://basehub.fun" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>basehub.fun</a></li>
            <li>X (Twitter): <a href="https://x.com/BaseHUBB" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>@BaseHUBB</a></li>
            <li>Farcaster: BaseHub</li>
          </ul>
        </section>

        <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px', textAlign: 'center' }}>
            By using BaseHub, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy

