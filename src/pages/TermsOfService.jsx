import React from 'react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { FileText, AlertTriangle, Shield, Coins, Users, Gavel } from 'lucide-react'

const TermsOfService = () => {
  return (
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
      <BackButton />
      
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <FileText size={32} style={{ color: '#3b82f6' }} />
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#e5e7eb' }}>
            Terms of Service
          </h1>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div style={{ color: '#e5e7eb', lineHeight: '1.8' }}>
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} /> Agreement to Terms
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            By accessing or using BaseHub ("the Platform," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access or use the Platform.
          </p>
          <p style={{ color: '#9ca3af' }}>
            BaseHub is a gamified smart contracts platform built on the Base network, accessible as a Farcaster miniapp and web application. These Terms apply to all users of the Platform.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} /> Eligibility
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            You must be at least 18 years old to use BaseHub. By using the Platform, you represent and warrant that:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px' }}>
            <li>You are of legal age in your jurisdiction</li>
            <li>You have the legal capacity to enter into these Terms</li>
            <li>You are not prohibited from using the Platform under applicable laws</li>
            <li>You will comply with all applicable laws and regulations</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} /> Platform Services
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            BaseHub provides the following services:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li><strong style={{ color: '#e5e7eb' }}>Gaming:</strong> Blockchain-based games (GM/GN, Coin Flip, Dice Roll, Lucky Number, Slots)</li>
            <li><strong style={{ color: '#e5e7eb' }}>XP System:</strong> Experience points, levels, and leaderboards</li>
            <li><strong style={{ color: '#e5e7eb' }}>NFT Minting:</strong> AI-generated NFT creation and minting</li>
            <li><strong style={{ color: '#e5e7eb' }}>Token Deployment:</strong> ERC20, ERC721, and ERC1155 token deployment</li>
            <li><strong style={{ color: '#e5e7eb' }}>Analysis Tools:</strong> Wallet analysis and contract security analysis</li>
            <li><strong style={{ color: '#e5e7eb' }}>Payment Services:</strong> x402 payment integration for premium features</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            We reserve the right to modify, suspend, or discontinue any service at any time without prior notice.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={20} /> Payments and Fees
          </h2>
          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Transaction Fees</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            All blockchain transactions require gas fees paid to the Base network. These fees are:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Paid directly to the network (not to BaseHub)</li>
            <li>Determined by network congestion</li>
            <li>Non-refundable once submitted</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Premium Features</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            Certain features require payment via x402 (Coinbase payment system):
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>AI NFT Generation: 0.1 USDC</li>
            <li>Wallet Analysis: 0.40 USDC</li>
            <li>Contract Security Analysis: 0.50 USDC</li>
            <li>Other premium features as announced</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            All payments are processed through x402 and are final. Refunds are only available in cases of technical errors on our part.
          </p>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>NFT Minting Fees</h3>
          <p style={{ color: '#9ca3af' }}>
            NFT minting requires payment of minting fees as determined by the smart contract. Fees vary based on quantity and are non-refundable.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} /> User Responsibilities
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            You agree to:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Maintain the security of your wallet and private keys</li>
            <li>Not use the Platform for any illegal or unauthorized purpose</li>
            <li>Not attempt to hack, exploit, or manipulate the Platform or smart contracts</li>
            <li>Not use automated scripts or bots to interact with the Platform</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Not impersonate any person or entity</li>
            <li>Not interfere with or disrupt the Platform's operation</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Smart Contracts and Blockchain</h2>
          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Irreversible Transactions</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            All blockchain transactions are:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Irreversible and permanent</li>
            <li>Publicly visible on BaseScan</li>
            <li>Subject to network fees and confirmation times</li>
            <li>Not controlled by BaseHub</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Smart Contract Risks</h3>
          <p style={{ color: '#9ca3af' }}>
            Smart contracts are code deployed on the blockchain. While we strive for security, smart contracts may contain bugs or vulnerabilities. You acknowledge that:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginTop: '12px' }}>
            <li>Smart contracts are immutable once deployed</li>
            <li>We cannot modify or reverse smart contract transactions</li>
            <li>You use smart contracts at your own risk</li>
            <li>We are not liable for smart contract bugs or exploits</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Intellectual Property</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            The Platform and its original content, features, and functionality are owned by BaseHub and protected by international copyright, trademark, and other intellectual property laws.
          </p>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            NFTs minted through BaseHub:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px' }}>
            <li>Are owned by the minter</li>
            <li>May be subject to copyright or licensing terms</li>
            <li>Can be transferred, sold, or traded</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gavel size={20} /> Disclaimers and Limitation of Liability
          </h2>
          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>No Warranty</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Warranties of merchantability</li>
            <li>Fitness for a particular purpose</li>
            <li>Non-infringement</li>
            <li>Accuracy or reliability of information</li>
          </ul>

          <h3 style={{ color: '#e5e7eb', fontSize: '18px', marginTop: '16px', marginBottom: '8px' }}>Limitation of Liability</h3>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BASEHUB SHALL NOT BE LIABLE FOR:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Any indirect, incidental, special, or consequential damages</li>
            <li>Loss of profits, data, or other intangible losses</li>
            <li>Damages resulting from use or inability to use the Platform</li>
            <li>Damages resulting from blockchain network issues</li>
            <li>Damages resulting from smart contract bugs or exploits</li>
            <li>Damages resulting from wallet security breaches</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Indemnification</h2>
          <p style={{ color: '#9ca3af' }}>
            You agree to indemnify and hold harmless BaseHub, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of the Platform, violation of these Terms, or infringement of any rights of another.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Termination</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            We may terminate or suspend your access to the Platform immediately, without prior notice, for any reason, including:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px', marginBottom: '12px' }}>
            <li>Violation of these Terms</li>
            <li>Fraudulent or illegal activity</li>
            <li>Abuse of the Platform or other users</li>
            <li>Technical or security reasons</li>
          </ul>
          <p style={{ color: '#9ca3af' }}>
            Upon termination, your right to use the Platform will cease immediately. However, blockchain transactions and NFT ownership are permanent and cannot be revoked.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Governing Law</h2>
          <p style={{ color: '#9ca3af' }}>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which BaseHub operates, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Platform shall be resolved through binding arbitration or in the appropriate courts.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Changes to Terms</h2>
          <p style={{ color: '#9ca3af' }}>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of the Platform after any changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e5e7eb', fontSize: '24px', marginBottom: '16px' }}>Contact Information</h2>
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <ul style={{ color: '#9ca3af', marginLeft: '24px' }}>
            <li>Website: <a href="https://basehub.fun" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>basehub.fun</a></li>
            <li>X (Twitter): <a href="https://x.com/BaseHubb" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>@BaseHubb</a></li>
            <li>Farcaster: BaseHub</li>
          </ul>
        </section>

        <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px', textAlign: 'center' }}>
            By using BaseHub, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService

