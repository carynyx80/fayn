// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Immutable, public time-based LP fees. No hook fee, identity classifier or pause.
contract FaynHook {
    using PoolIdLibrary for PoolKey;
    struct Policy { uint64 start; uint64 end; uint24 opening; uint24 normal; bool exists; }
    IPoolManager public immutable manager;
    address public immutable operator;
    mapping(PoolId => Policy) public policies;
    mapping(address => bool) public supported;
    uint24 public constant MAX_FEE = 100_000; // 10%, millionths
    uint64 public constant MAX_WINDOW = 1 days;
    event PolicyCreated(PoolId indexed poolId, uint64 start, uint64 end, uint24 opening, uint24 normal);
    event AssetSupported(address indexed token);
    error Unauthorized(); error InvalidPolicy(); error Unsupported(); error NotStarted();
    constructor(IPoolManager m, address op) {
        require(address(m) != address(0) && op != address(0));
        manager=m; operator=op;
        // beforeInitialize + beforeSwap. CREATE2 deployment must mine these low bits.
        require(uint160(address(this)) & ((1 << 14)-1) == ((1 << 13) | (1 << 7)), "hook address flags");
    }
    function allowAsset(address token) external {
        if(msg.sender!=operator) revert Unauthorized();
        if(token.code.length==0) revert Unsupported();
        supported[token]=true; emit AssetSupported(token);
    }
    function configure(PoolKey calldata key, uint64 start, uint64 end, uint24 opening, uint24 normal) external {
        if(msg.sender!=operator) revert Unauthorized();
        PoolId id=key.toId();
        if(policies[id].exists || address(key.hooks)!=address(this) || key.fee!=0x800000 ||
           start<block.timestamp || end<=start || end-start>MAX_WINDOW ||
           normal<100 || normal>10_000 || opening<normal || opening>MAX_FEE || key.tickSpacing!=60) revert InvalidPolicy();
        if(!supported[Currency.unwrap(key.currency0)] || !supported[Currency.unwrap(key.currency1)] ||
           Currency.unwrap(key.currency0)>=Currency.unwrap(key.currency1)) revert Unsupported();
        policies[id]=Policy(start,end,opening,normal,true);
        emit PolicyCreated(id,start,end,opening,normal);
    }
    function feeAt(PoolId id, uint256 time) public view returns(uint24) {
        Policy memory p=policies[id]; if(!p.exists) revert InvalidPolicy();
        if(time<=p.start) return p.opening;
        if(time>=p.end) return p.normal;
        // Round the decaying surcharge UP: never quote below the stated linear schedule.
        uint256 numerator=uint256(p.opening-p.normal)*(p.end-time);
        uint256 duration=p.end-p.start;
        return p.normal+uint24((numerator+duration-1)/duration);
    }
    function beforeInitialize(address sender,PoolKey calldata key,uint160) external view returns(bytes4) {
        if(msg.sender!=address(manager)) revert Unauthorized();
        if(sender!=operator) revert Unauthorized();
        if(!policies[key.toId()].exists) revert InvalidPolicy();
        return IHooks.beforeInitialize.selector;
    }
    function beforeSwap(address,PoolKey calldata key,SwapParams calldata,bytes calldata)
        external view returns(bytes4,BeforeSwapDelta,uint24) {
        if(msg.sender!=address(manager)) revert Unauthorized();
        if(block.timestamp<policies[key.toId()].start) revert NotStarted();
        return (IHooks.beforeSwap.selector,BeforeSwapDelta.wrap(0),feeAt(key.toId(),block.timestamp)|0x400000);
    }
}
