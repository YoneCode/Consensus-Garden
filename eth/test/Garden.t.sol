// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ConsensusGarden} from "../src/ConsensusGarden.sol";

contract GardenTest is Test {
    ConsensusGarden g;
    address relayer = address(0xBEEF);
    uint256 signerPk = 0xA11CE5161;
    address signerAddr;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 constant MINT_TYPEHASH = keccak256("Mint(address wallet,string github)");

    function setUp() public {
        signerAddr = vm.addr(signerPk);
        g = new ConsensusGarden(relayer, signerAddr, "https://consensus-garden.pages.dev/nft/?id=");
        vm.warp(1_700_000_000);
    }

    // Builds the backend EIP-712 signature attesting (wallet, github).
    function _sig(uint256 pk, address wallet, string memory github) internal view returns (bytes memory) {
        bytes32 domainSep = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Consensus Garden")),
            keccak256(bytes("1")),
            block.chainid,
            address(g)
        ));
        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, wallet, keccak256(bytes(github))));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _mint(address who, string memory github) internal returns (uint256) {
        bytes memory sig = _sig(signerPk, who, github);
        vm.prank(who);
        return g.mint(github, sig);
    }

    function test_MintWithValidSig() public {
        uint256 id = _mint(alice, "yonecode");
        assertEq(id, 1);
        assertEq(g.ownerOf(1), alice);
        assertEq(g.githubOf(1), "yonecode");
        assertEq(g.seedOf(1), uint256(uint160(alice)) & 0xFFFFFFFF);
    }

    function test_NoSigReverts() public {
        // a bot with no backend attestation cannot mint
        vm.prank(bob);
        vm.expectRevert(bytes("github not verified"));
        g.mint("botaccount", hex"");
    }

    function test_WrongSignerReverts() public {
        // signature from a different key is rejected
        bytes memory badSig = _sig(0xBAD5161, alice, "yonecode");
        vm.prank(alice);
        vm.expectRevert(bytes("github not verified"));
        g.mint("yonecode", badSig);
    }

    function test_SigBoundToWalletAndHandle() public {
        // signature minted for alice+yonecode cannot be replayed by bob
        bytes memory sigForAlice = _sig(signerPk, alice, "yonecode");
        vm.prank(bob);
        vm.expectRevert(bytes("github not verified"));
        g.mint("yonecode", sigForAlice);
    }

    function test_OnePerWallet() public {
        _mint(alice, "a");
        bytes memory sig = _sig(signerPk, alice, "b");
        vm.prank(alice);
        vm.expectRevert(bytes("one per wallet"));
        g.mint("b", sig);
    }

    function test_RevealOnlyRelayer() public {
        uint256 id = _mint(alice, "yonecode");
        vm.prank(bob);
        vm.expectRevert(bytes("not relayer"));
        g.reveal(id, 3);
        vm.prank(relayer);
        g.reveal(id, 3);
        assertTrue(g.revealed(id));
        assertEq(g.speciesView(id), 3);
    }

    function test_GrowthIncreasesWithTime() public {
        uint256 id = _mint(alice, "yonecode");
        uint256 a0 = g.agePMOf(id);
        vm.warp(block.timestamp + 30 days);
        assertGt(g.agePMOf(id), a0);
        assertLe(g.agePMOf(id), 1000);
    }

    function test_TokenURIShape() public {
        uint256 id = _mint(alice, "yonecode");
        bytes memory u = bytes(g.tokenURI(id));
        assertGt(u.length, 100);
        bytes memory pre = bytes("data:application/json;base64,");
        for (uint256 i = 0; i < pre.length; i++) assertEq(u[i], pre[i]);
    }

    function test_OwnerMintSeedsBuilder() public {
        // owner (this test contract) mints for a founding builder without their signature
        uint256 id = g.ownerMint(bob, "founder-bob");
        assertEq(g.ownerOf(id), bob);
        assertEq(g.githubOf(id), "founder-bob");
        // seed derives from the RECIPIENT, so they get their own tree
        assertEq(g.seedOf(id), uint256(uint160(bob)) & 0xFFFFFFFF);
    }

    function test_OwnerMintOnlyOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        g.ownerMint(bob, "x");
    }

    function test_TokenURIGasWorstCase() public {
        uint256 id = _mint(alice, "yonecode");
        vm.warp(block.timestamp + 250 days);
        uint256 gb = gasleft();
        string memory uri = g.tokenURI(id);
        emit log_named_uint("tokenURI gas (worst case)", gb - gasleft());
        emit log_named_uint("tokenURI bytes", bytes(uri).length);
        assertGt(bytes(uri).length, 1000);
    }
}
