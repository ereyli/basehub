// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * NFTCollection - Launchpad ERC721: deploy once, owner mints batch with same tokenURI.
 * contractURI() for OpenSea collection-level metadata (name, description, image).
 */
contract NFTCollection is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 public maxSupply;
    string private _contractURI;

    event BatchMinted(address indexed to, string tokenURI, uint256 quantity, uint256 startTokenId);
    event ContractURIUpdated(string newContractURI);

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        address initialOwner,
        string memory contractURI_
    ) ERC721(name, symbol) Ownable(initialOwner) {
        maxSupply = _maxSupply;
        _nextTokenId = 0;
        _contractURI = contractURI_;
    }

    /// @dev OpenSea / marketplaces use this for collection-level metadata (name, description, image).
    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    function mintBatch(address to, string calldata tokenURI_, uint256 quantity) external onlyOwner {
        uint256 current = _nextTokenId;
        require(current + quantity <= maxSupply, "Exceeds max supply");
        _nextTokenId = current + quantity;
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = current + i;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURI_);
        }
        emit BatchMinted(to, tokenURI_, quantity, current);
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
