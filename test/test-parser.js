import V2exParser from '../dist/index.esm.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testParser() {
    console.log('🚀 开始测试V2EX解析器...\n');

    const parser = new V2exParser();

    // 设置更长的超时时间
    const options = {
        timeout: 60000 // 60秒超时
    };

    try {
        // 测试: 尝试多页抓取（如果网络允许）
        console.log('📋 测试: 尝试多页抓取 (123456)');
        console.log('='.repeat(50));

        try {
            parser.setBaseUrl('https://global.v2ex.co');
            const multiPageInfo = await parser.parsePost('123456', { ...options, useMultiPage: true });
            console.log('✅ 多页抓取成功');

            // 保存多页结果到JSON文件
            const multiPagePath = path.join(__dirname, 'test_result_multi_page.json');
            fs.writeFileSync(multiPagePath, JSON.stringify(multiPageInfo, null, 2), 'utf8');
            console.log(`💾 多页结果已保存到: ${multiPagePath}`);

            // 显示关键信息摘要
            console.log(`📊 总页数: ${multiPageInfo.statistics.totalPages || 1}`);
            console.log(`📝 总回复数: ${multiPageInfo.statistics.replyCount}`);
            console.log(`👥 回复人ID数量: ${multiPageInfo.replyUserIds.length}`);
            console.log(`🏢 总楼层: ${multiPageInfo.statistics.totalFloors}`);

            if (multiPageInfo.pagination) {
                console.log(`📄 分页信息: 多页=${multiPageInfo.pagination.hasMultiplePages}, 总页数=${multiPageInfo.pagination.totalPages}`);
            }

        } catch (multiPageError) {
            console.log('⚠️ 多页抓取失败（可能是网络问题）:');
            console.log(`   错误: ${multiPageError.message}`);
        }

        console.log('\n🎉 所有测试完成！');
        console.log('📁 详细结果已保存到JSON文件中，请查看:');
        console.log(`   - 多页结果: test_result_multi_page.json`);

    } catch (error) {
        console.error('❌ 测试过程中出现错误:', error.message);
        console.error('错误详情:', error);
    }
}

// 运行测试
testParser();
