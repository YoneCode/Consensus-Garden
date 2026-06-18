// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TreeRenderer} from "../src/TreeRenderer.sol";

/// Verifies the Solidity renderer is byte-identical to the ground-truth
/// Python renderer (contracts/consensus_garden.py) across 960 cases.
contract RenderTest is Test {
    function test_AllCasesMatch() public {
        string memory j = vm.readFile("ref/cases.json");
        uint256 N = 960;
        uint256 mism = 0;
        for (uint256 i = 0; i < N; i++) {
            string memory base = string.concat("$[", vm.toString(i), "]");
            uint256 seed = vm.parseJsonUint(j, string.concat(base, ".seed"));
            int256 age = vm.parseJsonInt(j, string.concat(base, ".agePM"));
            uint256 sp = vm.parseJsonUint(j, string.concat(base, ".sp"));
            string memory ref = vm.parseJsonString(j, string.concat(base, ".svg"));
            string memory got = TreeRenderer.render(seed, age, sp);
            if (keccak256(bytes(got)) != keccak256(bytes(ref))) {
                mism++;
                if (mism <= 3) {
                    emit log_named_uint("MISMATCH case", i);
                    emit log_named_uint("  seed", seed);
                    emit log_named_int("  agePM", age);
                    emit log_named_uint("  sp", sp);
                    emit log_named_string("  expected", ref);
                    emit log_named_string("  got     ", got);
                }
            }
        }
        emit log_named_uint("total cases", N);
        emit log_named_uint("mismatches", mism);
        assertEq(mism, 0, "renderer not 1:1");
    }
}
