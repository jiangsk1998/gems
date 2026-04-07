use anchor_lang::prelude::*;

use crate::error::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        has_one = authority,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, crate::state::Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    ///CHECK: 金库地址，当前合约的PDA，所以这个地址是安全的
    #[account(mut,seeds =[b"treasury"], bump, )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: 这个账户是安全的，因为我们只是将资金转移到这个账户，而不读取或修改它的数据。
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, SkinsNftError::InvalidWithdrawAmount);
    require!(
        ctx.accounts.treasury.lamports() > amount,
        SkinsNftError::InsufficientFunds
    );

    //     new_with_signer 用于被调用的程序接受 PDA 作为签名者的场景。

    // 典型例子就是你代码里已经有的 Metaplex CPI：

    // metadata::create_master_edition_v3(
    //     CpiContext::new(   // ← 这里如果 authority 是 PDA 就要用 new_with_signer
    //         ctx.accounts.metadata_program.to_account_info(),
    //         ...
    //     ),
    //     Some(0),
    // )?;
    // 常见场景：

    // 场景	说明
    // Metaplex 创建/更新 metadata，authority 是 PDA	Metaplex 检查签名，不检查 owner
    // Token Program mint_to，mint authority 是 PDA	Token Program 检查签名
    // Token Program transfer，from 是 PDA token account	Token Program 检查签名
    // 调用自己写的其他程序，需要 PDA 授权	自定义程序检查签名
    // 核心判断标准：被调用的程序只验证"你有没有这个账户的签名权"，而不检查"这个账户的 owner 是不是我"。

    // System Program 的 transfer 比较特殊，它既检查签名又检查 owner，所以 PDA 过不了。其他大部分程序（Token、Metaplex 等）只检查签名，所以 new_with_signer 可以正常用。

    // anchor_lang::system_program::transfer(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.system_program.to_account_info(),
    //         anchor_lang::system_program::Transfer {
    //             from: ctx.accounts.treasury.to_account_info(),
    //             to: ctx.accounts.recipient.to_account_info(),
    //         },
    //         &[&[b"treasury", &[ctx.bumps.treasury]]],
    //     ),
    //     amount,
    // )?;
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let recipient_info = ctx.accounts.recipient.to_account_info();

    let mut treasury_lamports = treasury_info.try_borrow_mut_lamports()?;
    **treasury_lamports = treasury_lamports
        .checked_sub(amount)
        .ok_or(SkinsNftError::InsufficientFunds)?;
    drop(treasury_lamports);

    let mut recipient_lamports = recipient_info.try_borrow_mut_lamports()?;
    **recipient_lamports = recipient_lamports
        .checked_add(amount)
        .ok_or(SkinsNftError::Overflow)?;
    msg!(
        "Withdraw successful: {} lamports transferred to {}",
        amount,
        ctx.accounts.recipient.key()
    );
    Ok(())
}
