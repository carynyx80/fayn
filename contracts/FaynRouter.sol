// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId,PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FaynHook} from "./FaynHook.sol";
import {SwapParams,ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Restricted local integration router. Full-range positions isolated by wallet salt.
contract FaynRouter is IUnlockCallback,ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    IPoolManager public immutable manager;
    FaynHook public immutable hook;
    mapping(PoolId=>mapping(address=>uint128)) public liquidity;
    event PositionChanged(PoolId indexed poolId,address indexed user,int256 liquidityDelta,int128 amount0,int128 amount1,int128 fees0,int128 fees1);
    event Trade(PoolId indexed poolId,address indexed user,bool zeroForOne,int128 amount0,int128 amount1,uint24 fee);
    struct Action { PoolKey key; address user; bool swap; bool direction; int256 amount; uint256 limit; uint24 maxFee; uint256 deadline; uint256 max0; uint256 max1; }
    constructor(IPoolManager m,FaynHook h) { manager=m;hook=h; }
    function validate(PoolKey memory key) internal view {
        require(address(key.hooks)==address(hook) && key.fee==0x800000 && key.tickSpacing==60,"unsupported pool");
        require(hook.supported(Currency.unwrap(key.currency0)) && hook.supported(Currency.unwrap(key.currency1)),"unsupported assets");
    }
    /// @param amount negative for exact input; positive for exact output, per v4 convention.
    function swap(PoolKey calldata key,bool direction,int256 amount,uint256 limit,uint24 maxFee,uint256 deadline)
        external nonReentrant returns(int128,int128) {
        validate(key); require(amount!=0 && amount!=type(int256).min && deadline>=block.timestamp,"expired/amount");
        require(hook.feeAt(key.toId(),block.timestamp)<=maxFee,"fee increased");
        return abi.decode(manager.unlock(abi.encode(Action(key,msg.sender,true,direction,amount,limit,maxFee,deadline,0,0))),(int128,int128));
    }
    function modify(PoolKey calldata key,int256 change,uint256 max0,uint256 max1,uint256 deadline)
        external nonReentrant returns(int128,int128) {
        validate(key);require(deadline>=block.timestamp && change!=type(int256).min,"expired/change");
        uint128 old=liquidity[key.toId()][msg.sender];
        require(change>=-int256(uint256(old)) && change<=int256(uint256(type(uint128).max-old)),"position ownership");
        liquidity[key.toId()][msg.sender]=uint128(uint256(int256(uint256(old))+change));
        return abi.decode(manager.unlock(abi.encode(Action(key,msg.sender,false,false,change,0,0,deadline,max0,max1))),(int128,int128));
    }
    function unlockCallback(bytes calldata data) external returns(bytes memory) {
        require(msg.sender==address(manager),"manager only"); Action memory a=abi.decode(data,(Action));
        BalanceDelta delta;
        if(a.swap) {
            // Enforce full fill; no silent partial execution at price limits.
            delta=manager.swap(a.key,SwapParams(a.direction,a.amount,a.direction ? 4295128740 : 1461446703485210103287273052203988822378723970341),"");
            int128 input=a.direction?delta.amount0():delta.amount1();
            int128 output=a.direction?delta.amount1():delta.amount0();
            require(input<0 && output>0,"invalid deltas");
            if(a.amount<0) { require(uint256(uint128(-input))==uint256(-a.amount) && uint256(uint128(output))>=a.limit,"min output/partial"); }
            else { require(uint256(uint128(output))==uint256(a.amount) && uint256(uint128(-input))<=a.limit,"max input/partial"); }
            emit Trade(a.key.toId(),a.user,a.direction,delta.amount0(),delta.amount1(),hook.feeAt(a.key.toId(),block.timestamp));
        } else {
            BalanceDelta fees;
            (delta,fees)=manager.modifyLiquidity(a.key,ModifyLiquidityParams(-887220,887220,a.amount,bytes32(uint256(uint160(a.user)))),"");
            if(delta.amount0()<0) require(uint256(uint128(-delta.amount0()))<=a.max0,"max token0");
            if(delta.amount1()<0) require(uint256(uint128(-delta.amount1()))<=a.max1,"max token1");
            // On removal max0/max1 encode minimum outputs.
            if(a.amount<0) require(delta.amount0()>=0 && delta.amount1()>=0 && uint128(delta.amount0())>=a.max0 && uint128(delta.amount1())>=a.max1,"min withdrawal");
            emit PositionChanged(a.key.toId(),a.user,a.amount,delta.amount0(),delta.amount1(),fees.amount0(),fees.amount1());
        }
        settle(a.key.currency0,a.user,delta.amount0()); settle(a.key.currency1,a.user,delta.amount1());
        return abi.encode(delta.amount0(),delta.amount1());
    }
    function settle(Currency currency,address user,int128 delta) internal {
        if(delta<0) {
            manager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransferFrom(user,address(manager),uint128(-delta));
            require(manager.settle()==uint128(-delta),"nonstandard transfer");
        } else if(delta>0) manager.take(currency,user,uint128(delta));
    }
}
