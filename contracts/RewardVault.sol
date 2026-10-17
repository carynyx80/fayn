// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
/// @notice Sponsor funded, explicitly attributed grants. No volume-based eligibility claim.
contract RewardVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable sponsor;
    bool public immutable enabled;
    mapping(bytes32=>uint256) public available;
    mapping(address=>uint256) public liabilities;
    event Funded(bytes32 indexed poolId,uint256 indexed epoch,address indexed user,address token,uint256 amount);
    event Claimed(bytes32 indexed poolId,uint256 indexed epoch,address indexed user,address token,uint256 amount);
    constructor(address s,bool e) { require(s!=address(0)); sponsor=s; enabled=e; }
    function key(bytes32 pool,uint256 epoch,address user,address token) public view returns(bytes32) {
        return keccak256(abi.encode(block.chainid,address(this),pool,epoch,user,token));
    }
    function fund(bytes32 pool,uint256 epoch,address user,IERC20 token,uint256 amount) external nonReentrant {
        require(enabled && msg.sender==sponsor && user!=address(0) && amount>0,"funding disabled/invalid");
        uint256 old=token.balanceOf(address(this)); token.safeTransferFrom(msg.sender,address(this),amount);
        require(token.balanceOf(address(this))-old==amount,"unsupported token");
        available[key(pool,epoch,user,address(token))]+=amount; liabilities[address(token)]+=amount;
        emit Funded(pool,epoch,user,address(token),amount);
    }
    function claim(bytes32 pool,uint256 epoch,IERC20 token) external nonReentrant {
        bytes32 k=key(pool,epoch,msg.sender,address(token)); uint256 a=available[k]; require(a>0,"nothing funded");
        available[k]=0; liabilities[address(token)]-=a; token.safeTransfer(msg.sender,a);
        emit Claimed(pool,epoch,msg.sender,address(token),a);
    }
}
