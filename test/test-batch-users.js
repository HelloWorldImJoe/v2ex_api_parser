import V2exParser from '../dist/index.esm.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBatchUserParsing() {
    console.log('🚀 开始测试批量用户名解析功能...\n');

    const parser = new V2exParser();

    // 测试用户名列表（这些是示例用户名，您可以根据需要修改）
    const testUsernames = [
        'Livid',           // V2EX创始人
        'acros',           // 知名用户
    ];

    console.log(`📋 准备解析 ${testUsernames.length} 个用户:`);
    testUsernames.forEach((username, index) => {
        console.log(`   ${index + 1}. ${username}`);
    });
    console.log('');

    try {
        console.log('🔧 使用 parseMultipleUsers 方法');
        console.log('='.repeat(60));
        parser.setBaseUrl('https://global.v2ex.co');
        const batchResults = await parser.parseMultipleUsers(testUsernames, {
            timeout: 15000,        // 15秒超时
            delay: 1500,           // 1.5秒请求间隔
            retryCount: 2,         // 失败重试2次
            showProgress: true     // 显示进度
        });

        // 保存结果到JSON文件
        const batchResultsPath = path.join(__dirname, 'batch_users_result.json');
        fs.writeFileSync(batchResultsPath, JSON.stringify(batchResults, null, 2), 'utf8');
        console.log(`\n💾 批量解析结果已保存到: ${batchResultsPath}`);

        // 显示成功和失败的统计
        const successResults = batchResults.filter(r => r.success);
        const failureResults = batchResults.filter(r => !r.success);

        console.log('\n📊 解析结果统计:');
        console.log(`✅ 成功解析: ${successResults.length} 个用户`);
        console.log(`❌ 解析失败: ${failureResults.length} 个用户`);

        if (successResults.length > 0) {
            console.log('\n✅ 成功解析的用户信息摘要:');
            successResults.forEach((result, index) => {
                const userData = result.data;
                console.log(`   ${index + 1}. ${result.username}`);
                console.log(`      - 会员ID: ${userData.memberId || 'N/A'}`);
                console.log(`      - 加入时间: ${userData.joinTime || 'N/A'}`);
                console.log(`      - 活跃排名: ${userData.activeRank || 'N/A'}`);
                console.log(`      - 个人签名: ${userData.signature ? userData.signature.substring(0, 50) + '...' : 'N/A'}`);
                console.log(`      - Solana地址: ${userData.solanaAddress || 'N/A'}`);
                console.log(`      - 最近回复数: ${userData.recentReplies ? userData.recentReplies.length : 0}`);
                console.log('');
            });
        }

        if (failureResults.length > 0) {
            console.log('\n❌ 解析失败的用户:');
            failureResults.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.username} - ${result.error}`);
            });
        }
    } catch (error) {
        console.error('❌ 批量解析过程中出现错误:', error.message);
        console.error('错误详情:', error);
    }
}

// 运行测试
testBatchUserParsing();
