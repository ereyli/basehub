

* Kullanıcı prompt yazar,
* Yapay zeka (örnek olarak placeholder AI) görseli üretir,
* nft.storage’a yükler,
* Remix’ten deploy ettiğin kontrata mint eder,
* Görsel NFT olarak cüzdana düşer 💥

---

## 🧠 Cursor Prompt – “AI NFT Launchpad” (senin senaryona özel)

> Bunu **Cursor’a yapıştır** (tek komutla proje çıkaracak 👇)

````
Create a complete Next.js + TypeScript + TailwindCSS dApp called "AI NFT Launchpad" where users can generate AI images and mint them as NFTs on Base network.

Goal:
User enters a text prompt → app generates an AI image (placeholder now) → uploads it to IPFS via nft.storage → mints NFT on Remix-deployed contract (address provided in .env.local).

---

### ✅ Features to include

1. **Frontend**
   - Page: `/app/launchpad/page.tsx`
   - Components:
     - `PromptInput.tsx`: text box for image prompt
     - `ImagePreview.tsx`: shows generated image
     - `MintButton.tsx`: uploads image + metadata to IPFS, calls contract
     - `ConnectWallet.tsx`: MetaMask connect/disconnect
   - UI: clean Base-style with Tailwind (blue gradient background, white cards, rounded buttons)
   - Loading + success + error states for user feedback

2. **AI Image Generation**
   - Add a placeholder function:
     ```ts
     export async function generateAIImage(prompt: string): Promise<string> {
       // placeholder AI: creates blue image with prompt text
       const canvas = document.createElement("canvas");
       const ctx = canvas.getContext("2d");
       canvas.width = 512; canvas.height = 512;
       ctx.fillStyle = "#0052ff"; ctx.fillRect(0, 0, 512, 512);
       ctx.fillStyle = "white"; ctx.font = "24px sans-serif";
       ctx.fillText(prompt.slice(0, 25), 50, 260);
       return canvas.toDataURL("image/png").replace(/^data:image\\/png;base64,/, "");
     }
     ```
   - Make it modular so we can later replace with real AI (OpenAI / Stability / Replicate API).

3. **IPFS Storage**
   - Use `nft.storage` for uploading both image and metadata.
   - Create `lib/nftStorage.ts`:
     ```ts
     import { NFTStorage, File } from 'nft.storage';
     export async function uploadToIPFS(imageBase64: string, prompt: string, apiKey: string) {
       const client = new NFTStorage({ token: apiKey });
       const buffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
       const imageFile = new File([buffer], "image.png", { type: "image/png" });
       const metadata = await client.store({
         name: `AI NFT - ${prompt.slice(0, 20)}`,
         description: `AI-generated NFT created from the prompt: "${prompt}"`,
         image: imageFile,
       });
       return metadata.url; // returns ipfs://CID
     }
     ```

4. **Smart Contract Integration**
   - User connects wallet via MetaMask → ethers.js → Base network.
   - Contract ABI:
     ```ts
     export const CONTRACT_ABI = [
       "function mintWithTokenURI(address to, string tokenURI) payable returns (uint256)",
       "function mintPrice() view returns (uint256)"
     ];
     ```
   - Create `lib/contract.ts`:
     ```ts
     import { ethers } from "ethers";
     import { CONTRACT_ABI } from "./abi";

     export async function getContract(signer: any) {
       const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
       return new ethers.Contract(addr, CONTRACT_ABI, signer);
     }

     export async function mintNFT(signer: any, tokenURI: string) {
       const contract = await getContract(signer);
       const price = await contract.mintPrice();
       const tx = await contract.mintWithTokenURI(await signer.getAddress(), tokenURI, { value: price });
       await tx.wait();
       return tx.hash;
     }
     ```

5. **Environment Variables**
   Add `.env.local`:
````

NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourRemixDeployedAddress
NEXT_PUBLIC_NFT_STORAGE_KEY=your_nft_storage_api_key

```

6. **Flow**
- Connect wallet
- Enter prompt
- Click “Generate” → preview AI image
- Click “Mint NFT” → upload to IPFS → get tokenURI → call mintWithTokenURI
- Show success message + tx hash (link to BaseScan)

7. **Dependencies**
```

npm install ethers nft.storage

```

8. **Style**
- Tailwind config with Base blue gradient: `bg-gradient-to-br from-blue-500 to-blue-700`
- Card components: `bg-white p-4 rounded-2xl shadow-md`
- Buttons: `bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl`

9. **Final Page Layout**
- Header: “AI NFT Launchpad”
- Prompt input → Generate button
- Preview image
- Mint button + transaction status
- Wallet connect in top-right corner

10. **Important Notes**
- The app does NOT deploy the contract. You will deploy it manually via Remix and paste the address in `.env.local`.
- The frontend should automatically read `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_NFT_STORAGE_KEY`.
- Default mint fee = 0.001 ETH (from your Remix contract).
- Network target = Base or Base Sepolia testnet.

---

### GOAL:
Deliver a **fully working client-side dApp** that:
- Generates AI images (placeholder for now)
- Uploads image + metadata to IPFS
- Calls your Remix-deployed contract to mint NFTs
- Provides complete UI + code structure + connection flow
```

---



