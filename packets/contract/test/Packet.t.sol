// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Packet, IERC20Minimal} from "../src/Packet.sol";

/// Minimal ERC20 for tests — no OpenZeppelin dependency.
contract MockERC20 is IERC20Minimal {
    string public name = "Mock USD";
    string public symbol = "mUSD";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract PacketTest is Test {
    MockERC20 usdc;
    Packet packet;

    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address collector = makeAddr("collector");

    uint96 constant AMOUNT = 1_000_000; // $1.00 in 6-decimal units
    uint32 constant LIMIT = 3;

    function setUp() public {
        usdc = new MockERC20();
        packet = new Packet(creator, 0, collector); // 0% fee by default
        usdc.mint(creator, 1_000_000_000);
        usdc.mint(alice, 1_000_000_000);
        usdc.mint(bob, 1_000_000_000);
        vm.prank(creator);
        usdc.approve(address(packet), type(uint256).max);
    }

    // ------------------------------------------------------------------
    // Create
    // ------------------------------------------------------------------

    function testCreateFundsVaultAndEmits() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, 0);

        assertEq(id, 1);
        assertEq(packet.nextPacketId(), 1); // pre-increment: counter shows current id
        assertEq(usdc.balanceOf(address(packet)), AMOUNT);
        assertEq(usdc.balanceOf(address(collector)), 0);

        Packet.PacketState memory p = packet.getPacket(id);
        assertEq(p.creator, creator);
        assertEq(p.token, address(usdc));
    }

    function testCreateTakesFeeOnTop() public {
        // Deploy a fee-charging instance.
        packet = new Packet(creator, 500, collector); // 5% — the ceiling
        vm.startPrank(creator);
        usdc.approve(address(packet), type(uint256).max);
        packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, 0);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(packet)), AMOUNT, "vault gets the FULL amount");
        assertEq(usdc.balanceOf(collector), 50_000, "fee on top, never deducted");
        assertEq(packet.feeFor(AMOUNT), 50_000);
    }

    function testRevertFeeTooHighAtDeploy() public {
        vm.expectRevert(Packet.FeeTooHigh.selector);
        new Packet(creator, 501, collector);
    }

    function testRevertZeroRecipientLimit() public {
        vm.prank(creator);
        vm.expectRevert(Packet.InvalidRecipientLimit.selector);
        packet.createPacket(address(usdc), AMOUNT, 0, Packet.Mode.Equal, 0);
    }

    function testRevertLimitOver100() public {
        vm.prank(creator);
        vm.expectRevert(Packet.InvalidRecipientLimit.selector);
        packet.createPacket(address(usdc), AMOUNT, 101, Packet.Mode.Equal, 0);
    }

    function testRevertAmountTooSmall() public {
        vm.prank(creator);
        vm.expectRevert(Packet.AmountTooSmall.selector);
        packet.createPacket(address(usdc), 2, 3, Packet.Mode.Equal, 0);
    }

    function testRevertRandomMode() public {
        vm.prank(creator);
        vm.expectRevert(Packet.RandomNotSupported.selector);
        packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Random, 0);
    }

    function testRevertPastExpiry() public {
        vm.warp(1_000_000); // default foundry clock is block 1 — expiry must be real
        vm.prank(creator);
        vm.expectRevert(Packet.InvalidExpiry.selector);
        packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp - 1));
    }

    function testRevertInsufficientAllowance() public {
        vm.prank(alice); // no allowance
        vm.expectRevert();
        packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, 0);
    }

    // ------------------------------------------------------------------
    // Claim
    // ------------------------------------------------------------------

    function testEqualSplitAndDustToLast() public {
        // $1.00 split 3 ways: 333_333 each claimer, 334 would-be dust.
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, 0);

        vm.prank(alice);
        packet.claimPacket(id);
        assertEq(usdc.balanceOf(alice), 1_000_000_000 + 333_333);

        vm.prank(bob);
        packet.claimPacket(id);
        assertEq(usdc.balanceOf(bob), 1_000_000_000 + 333_333);

        vm.prank(creator);
        packet.claimPacket(id); // creator claims last share — sweeps the dust
        // Creator funded the packet: 1e9 − 1e6 funded + 333_334 back.
        assertEq(usdc.balanceOf(creator), 1_000_000_000 - 1_000_000 + 333_334);

        assertEq(usdc.balanceOf(address(packet)), 0, "nothing left behind");
        assertEq(uint8(packet.getPacket(id).status), uint8(Packet.Status.Completed));
    }

    function testRevertDoubleClaim() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, 0);

        vm.prank(alice);
        packet.claimPacket(id);
        vm.prank(alice);
        vm.expectRevert(Packet.AlreadyClaimed.selector);
        packet.claimPacket(id);
    }

    function testRevertNoClaimsLeft() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, 1, Packet.Mode.Equal, 0);

        vm.prank(alice);
        packet.claimPacket(id);

        // Status check precedes the count check (same as the Anchor program):
        // a completed packet reads as NotActive.
        vm.prank(bob);
        vm.expectRevert(Packet.NotActive.selector);
        packet.claimPacket(id);
    }

    function testRevertClaimAfterExpiry() public {
        vm.warp(1_000_000); // fixed clock so expiry math is deterministic
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp + 100));

        vm.warp(block.timestamp + 101);
        vm.prank(alice);
        vm.expectRevert(Packet.Expired.selector);
        packet.claimPacket(id);
    }

    function testRevertClaimOnUnfundedPacket() public {
        vm.prank(alice);
        vm.expectRevert(Packet.NotActive.selector); // id 0 has no creator
        packet.claimPacket(0);
    }

    // ------------------------------------------------------------------
    // Refund
    // ------------------------------------------------------------------

    function testRefundAfterExpiryReturnsRemainder() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp + 100));

        vm.prank(alice);
        packet.claimPacket(id); // 333_333 claimed
        vm.warp(block.timestamp + 101);

        vm.prank(creator);
        packet.refundPacket(id);

        uint256 expected = AMOUNT - 333_333;
        // Creator funded the packet: 1e9 − 1e6 funded + refund of the remainder.
        assertEq(usdc.balanceOf(creator), 1_000_000_000 - 1_000_000 + expected);
        assertEq(usdc.balanceOf(address(packet)), 0);
        assertEq(uint8(packet.getPacket(id).status), uint8(Packet.Status.Closed));
    }

    function testCompletedPacketLeavesNothingToRefund() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, 2, Packet.Mode.Equal, 0);

        // Full claim: alice 500_000, bob (last) sweeps the remaining 500_000.
        vm.prank(alice);
        packet.claimPacket(id);
        vm.prank(bob);
        packet.claimPacket(id);
        assertEq(uint8(packet.getPacket(id).status), uint8(Packet.Status.Completed));

        // The last claimer always sweeps the dust, so a completed packet has
        // nothing left to refund (mirrors the Anchor invariant).
        vm.prank(creator);
        vm.expectRevert(Packet.NothingToRefund.selector);
        packet.refundPacket(id);
    }

    function testRevertRefundNotCreator() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp + 100));

        vm.warp(block.timestamp + 101);
        vm.prank(alice);
        vm.expectRevert(Packet.Unauthorized.selector);
        packet.refundPacket(id);
    }

    function testRevertRefundBeforeExpiry() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp + 100));

        vm.prank(creator);
        vm.expectRevert(Packet.NotRefundable.selector);
        packet.refundPacket(id);
    }

    function testRevertRefundTwice() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, LIMIT, Packet.Mode.Equal, uint48(block.timestamp + 100));
        vm.warp(block.timestamp + 101);

        vm.prank(creator);
        packet.refundPacket(id);

        vm.prank(creator);
        vm.expectRevert(Packet.AlreadyClosed.selector);
        packet.refundPacket(id);
    }

    function testRevertRefundNothingToRefund() public {
        vm.prank(creator);
        uint256 id = packet.createPacket(address(usdc), AMOUNT, 1, Packet.Mode.Equal, uint48(block.timestamp + 100));

        vm.prank(alice);
        packet.claimPacket(id); // fully claimed — vault empty
        vm.warp(block.timestamp + 101);

        vm.prank(creator);
        vm.expectRevert(Packet.NothingToRefund.selector);
        packet.refundPacket(id);
    }

    // ------------------------------------------------------------------
    // Admin config
    // ------------------------------------------------------------------

    function testUpdateConfig() public {
        vm.prank(creator);
        packet.updateConfig(100, bob, alice);

        assertEq(packet.feeBps(), 100);
        assertEq(packet.feeCollector(), bob);
        assertEq(packet.admin(), alice);
    }

    function testRevertUpdateConfigNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(Packet.Unauthorized.selector);
        packet.updateConfig(100, bob, address(0));
    }

    function testRevertUpdateConfigFeeTooHigh() public {
        vm.prank(creator);
        vm.expectRevert(Packet.FeeTooHigh.selector);
        packet.updateConfig(501, address(0), address(0));
    }
}
