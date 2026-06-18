// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {TreeRenderer} from "./TreeRenderer.sol";

/// @title ConsensusGarden (Ethereum)
/// @notice Living, fully on-chain tree NFT. Supply 1,000, one per wallet, free
/// (caller pays gas). The 2D artwork is rendered on-chain (byte-identical to the
/// GenLayer original) and grows over real time via block.timestamp. The species
/// is decided off-chain by GenLayer AI consensus (GitHub -> species) and written
/// here by a trusted relayer via reveal(). The 3D viewer is the animation_url.
contract ConsensusGarden is ERC721, Ownable, EIP712 {
    uint256 public constant CAP = 1000;
    uint256 public totalMinted;

    address public relayer;       // GenLayer settlement relayer (sets species)
    address public signer;        // backend that attests GitHub (verified + >=1mo old)
    string public baseViewer;     // e.g. "https://consensus-garden.pages.dev/nft/?id="

    // EIP-712: backend signs Mint(wallet, github) only after verifying the
    // wallet owner connected a real GitHub account that is at least 1 month old.
    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(address wallet,string github)");

    mapping(uint256 => uint256) public seedOf;
    mapping(uint256 => uint256) public mintTime;
    mapping(uint256 => uint8) private _species;
    mapping(uint256 => bool) public revealed;
    mapping(uint256 => string) public githubOf;
    mapping(address => uint256) public tokenOf; // 0 = none (ids start at 1)

    event Planted(uint256 indexed id, address indexed owner, uint256 seed, string github);
    event Revealed(uint256 indexed id, uint8 species);

    constructor(address _relayer, address _signer, string memory _baseViewer)
        ERC721("Consensus Garden", "GARDEN")
        Ownable(msg.sender)
        EIP712("Consensus Garden", "1")
    {
        relayer = _relayer;
        signer = _signer;
        baseViewer = _baseViewer;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    function setRelayer(address r) external onlyOwner {
        relayer = r;
    }

    function setSigner(address s) external onlyOwner {
        signer = s;
    }

    /// @notice Recovers the backend signer from an EIP-712 Mint attestation.
    function verifyMint(address wallet, string calldata github, bytes calldata signature)
        public
        view
        returns (bool)
    {
        if (signer == address(0)) return false;
        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, wallet, keccak256(bytes(github))));
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        return err == ECDSA.RecoverError.NoError && recovered == signer;
    }

    function setBaseViewer(string calldata b) external onlyOwner {
        baseViewer = b;
    }

    /// @notice seed = low 32 bits of the wallet address (>=1). Matches the
    /// GenLayer `_seed`, so the same wallet grows the same tree as on GenLayer.
    function seedForWallet(address w) public pure returns (uint256 s) {
        s = uint256(uint160(w)) & 0xFFFFFFFF;
        if (s == 0) s = 1;
    }

    /// @notice Owner seeds a tree for a founding builder (you pay gas). The seed
    /// derives from THEIR address, so they get the exact tree they'd mint
    /// themselves. No signature needed (owner is trusted); the public mint stays
    /// gated. The relayer reveals their species from `github` as usual.
    function ownerMint(address to, string calldata github) external onlyOwner returns (uint256 id) {
        require(totalMinted < CAP, "sold out");
        require(to != address(0), "zero address");
        require(tokenOf[to] == 0, "already has tree");
        id = ++totalMinted;
        seedOf[id] = seedForWallet(to);
        mintTime[id] = block.timestamp;
        tokenOf[to] = id;
        githubOf[id] = github;
        _safeMint(to, id);
        emit Planted(id, to, seedOf[id], github);
    }

    function mint(string calldata github, bytes calldata signature) external returns (uint256 id) {
        require(totalMinted < CAP, "sold out");
        require(tokenOf[msg.sender] == 0, "one per wallet");
        require(verifyMint(msg.sender, github, signature), "github not verified");
        id = ++totalMinted;
        seedOf[id] = seedForWallet(msg.sender);
        mintTime[id] = block.timestamp;
        tokenOf[msg.sender] = id;
        githubOf[id] = github;
        _safeMint(msg.sender, id);
        emit Planted(id, msg.sender, seedOf[id], github);
    }

    /// @notice Token owner can set/correct their GitHub handle (re-triggers a
    /// fresh GenLayer species reveal off-chain by the relayer watching this).
    function setGithub(uint256 id, string calldata github) external {
        require(ownerOf(id) == msg.sender, "not owner");
        githubOf[id] = github;
        emit Planted(id, msg.sender, seedOf[id], github);
    }

    /// @notice Called by the GenLayer relayer once validators agree on the
    /// owner's species (read from their GitHub via AI consensus).
    function reveal(uint256 id, uint8 species) external onlyRelayer {
        require(_ownerOf(id) != address(0), "no token");
        _species[id] = species % 5;
        revealed[id] = true;
        emit Revealed(id, species % 5);
    }

    /// @notice Growth per-mille (0..1000) from elapsed seconds. Port of
    /// `_growth_pm`. All operands positive here, so `/` == Python `//`.
    function growthPM(uint256 t) public pure returns (uint256) {
        uint32[6] memory bt = [uint32(0), 3600, 86400, 604800, 2592000, 15552000];
        uint16[6] memory bp = [uint16(0), 120, 300, 550, 800, 1000];
        if (t == 0) return 0;
        for (uint256 i = 1; i < 6; i++) {
            if (t < bt[i]) {
                uint256 t0 = bt[i - 1];
                uint256 p0 = bp[i - 1];
                uint256 t1 = bt[i];
                uint256 p1 = bp[i];
                return p0 + (p1 - p0) * (t - t0) / (t1 - t0);
            }
        }
        return 1000;
    }

    /// @notice Standard collection size (so Etherscan/marketplaces display it).
    function totalSupply() public view returns (uint256) {
        return totalMinted;
    }

    function speciesView(uint256 id) public view returns (uint8) {
        if (revealed[id]) return _species[id];
        return uint8(seedOf[id] % 5); // provisional until GenLayer reveals
    }

    function agePMOf(uint256 id) public view returns (uint256) {
        return growthPM(block.timestamp - mintTime[id]);
    }

    function renderSVG(uint256 id) public view returns (string memory) {
        require(_ownerOf(id) != address(0), "no token");
        return TreeRenderer.render(seedOf[id], int256(agePMOf(id)), speciesView(id));
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        require(_ownerOf(id) != address(0), "no token");
        string memory svg = TreeRenderer.render(seedOf[id], int256(agePMOf(id)), speciesView(id));
        string memory json = string.concat(
            '{"name":"Consensus Garden #',
            Strings.toString(id),
            '","description":"A living, fully on-chain tree. Its species is forged from the owner\'s GitHub by GenLayer AI consensus; it grows over real time.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","animation_url":"',
            baseViewer,
            Strings.toString(id),
            '","attributes":[',
            '{"trait_type":"Species","value":"',
            _speciesName(speciesView(id)),
            '"},{"trait_type":"Age (months)","value":',
            Strings.toString(agePMOf(id) * 170 / 1000),
            '},{"trait_type":"Revealed","value":"',
            revealed[id] ? "yes" : "no",
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _speciesName(uint8 sp) internal pure returns (string memory) {
        if (sp == 0) return "Maple";
        if (sp == 1) return "Sakura";
        if (sp == 2) return "Pine";
        if (sp == 3) return "Ember";
        return "Frost";
    }
}
