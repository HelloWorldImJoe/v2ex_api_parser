const axios = require('axios');
const cheerio = require('cheerio');

/**
 * V2EX解析器类
 * 支持解析用户信息页面和帖子页面
 */
class V2exParser {
    constructor(options = {}) {
        // 设置默认域名
        this.baseUrl = options.baseUrl || 'https://v2ex.com';

        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
        this.headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cache-control': 'max-age=0',
            'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': this.userAgent
        };
    }

    /**
     * 智能解析V2EX页面
     * 自动识别是用户信息页面还是帖子页面
     * @param {string} url - V2EX页面URL
     * @param {Object} options - 解析选项
     * @returns {Promise<Object>} 结构化的JSON数据
     */
    async parseV2exPage(url, options = {}) {
        try {
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: options.timeout || 10000
            });

            const $ = cheerio.load(response.data);

            // 判断页面类型
            if (url.includes('/member/')) {
                return await this.parseUserInfoPage($, url, options);
            } else if (url.includes('/t/')) {
                return await this.parsePostPage($, url, options);
            } else {
                throw new Error('不支持的页面类型，请使用用户信息页面(/member/)或帖子页面(/t/)');
            }
        } catch (error) {
            throw new Error(`解析V2EX页面失败: ${error.message}`);
        }
    }

    /**
     * 解析用户信息页面
     * @param {Object} $ - cheerio对象
     * @param {string} url - 页面URL
     * @param {Object} options - 解析选项
     * @returns {Object} 用户信息JSON
     */
    async parseUserInfoPage($, url, options = {}) {
        // 提取用户名
        const username = $('h1').first().text().trim();

        // 提取用户ID
        const urlMatch = url.match(/\/member\/([^\/]+)/);
        const userId = urlMatch ? urlMatch[1] : '';

        // 提取头像URL
        const avatarUrl = $('.avatar').first().attr('src') || '';

        // 提取个人签名
        const signature = $('.bigger').text().trim();

        // 提取会员信息
        const memberInfo = $('.gray').first().text().trim();
        const memberIdMatch = memberInfo.match(/V2EX 第 (\d+) 号会员/);
        const memberId = memberIdMatch ? memberIdMatch[1] : '';

        const joinTimeMatch = memberInfo.match(/加入于 ([\d\-\s:]+)/);
        const joinTime = joinTimeMatch ? joinTimeMatch[1] : '';

        const activeRankMatch = memberInfo.match(/今日活跃度排名 (\d+)/);
        const activeRank = activeRankMatch ? activeRankMatch[1] : '';

        // 提取会员类型
        const isPro = $('.badge.pro').length > 0;

        // 提取社交链接
        const socialLinks = {};
        $('.social_label').each((index, element) => {
            const $el = $(element);
            const href = $el.attr('href');
            const text = $el.text().trim();

            if (href.includes('twitter.com') || href.includes('x.com')) {
                socialLinks.twitter = { url: href, username: text };
            } else if (href.includes('github.com')) {
                socialLinks.github = { url: href, username: text };
            } else if (href.includes('telegram.me')) {
                socialLinks.telegram = { url: href, username: text };
            } else if (href.includes('google.com/maps')) {
                socialLinks.location = { url: href, location: text };
            } else if (href && !href.startsWith('http')) {
                // 其他链接
                socialLinks.website = { url: href, name: text };
            }
        });

        // 提取Solana地址
        const solanaAddress = this.extractSolanaAddress($);

        // 提取最近回复
        const recentReplies = [];
        $('.dock_area').each((index, element) => {
            const $el = $(element);
            const timeText = $el.find('.fade').attr('title') || $el.find('.fade').text().trim();
            // 提取回复内容（保持原始换行格式）
            const replyContentElement = $el.next('.inner').find('.reply_content');
            let replyText = '';
            if (replyContentElement.length > 0) {
                replyText = replyContentElement.html()
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .trim();
            }
            const topicLink = $el.find('a[href*="/t/"]').attr('href');
            const topicId = topicLink ? topicLink.match(/\/t\/(\d+)/)?.[1] : '';

            if (replyText) {
                recentReplies.push({
                    time: timeText,
                    content: replyText,
                    topicId: topicId,
                    topicUrl: topicId ? `${this.baseUrl}/t/${topicId}` : ''
                });
            }
        });

        // 构建用户信息JSON
        const userInfo = {
            type: 'user_info',
            url: url,
            username: username,
            userId: userId,
            memberId: memberId,
            avatar: avatarUrl,
            signature: signature,
            joinTime: joinTime,
            activeRank: activeRank,
            isPro: isPro,
            socialLinks: socialLinks,
            solanaAddress: solanaAddress,
            recentReplies: recentReplies,
            parsedAt: new Date().toISOString()
        };

        return userInfo;
    }

    /**
     * 解析帖子页面
     * @param {Object} $ - cheerio对象
     * @param {string} url - 页面URL
     * @param {Object} options - 解析选项
     * @returns {Object} 帖子信息JSON
     */
    async parsePostPage($, url, options = {}) {
        // 提取帖子ID
        const urlMatch = url.match(/\/t\/(\d+)/);
        const postId = urlMatch ? urlMatch[1] : '';

        // 提取帖子标题
        const title = $('h1').first().text().trim();

        // 提取发帖人信息
        const authorElement = $('.header small.gray a[href*="/member/"]').first();
        const authorName = authorElement.text().trim();
        const authorId = authorElement.attr('href') ? authorElement.attr('href').replace('/member/', '') : '';
        const authorAvatar = $('.header img.avatar').first().attr('src') || '';

        // 提取发帖时间
        const postTimeElement = $('.header .gray .ago, .header .gray span[title]');
        const postTime = postTimeElement.attr('title') || postTimeElement.text().trim();

        // 提取点击次数
        const clickCountMatch = $('.header .gray').text().match(/(\d+) 次点击/);
        const clickCount = clickCountMatch ? clickCountMatch[1] : '';

        // 提取帖子内容（保持原始换行格式）
        const contentElement = $('.topic_content').first();
        let content = '';
        if (contentElement.length > 0) {
            content = contentElement.html()
                .replace(/<br\s*\/?>/gi, '\n')  // 将 <br> 标签转换为换行符
                .replace(/<[^>]*>/g, '')        // 移除其他HTML标签
                .replace(/&nbsp;/g, ' ')        // 转换HTML实体
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .trim();
        }

        // 提取标签
        const tags = [];
        $('.tag').each((index, element) => {
            const tagText = $(element).text().trim();
            if (tagText) {
                tags.push(tagText);
            }
        });

        // 提取回复人ID数组（从JavaScript代码中）
        const replyUserIds = this.extractReplyUserIds($);

        // 提取回复信息
        const replies = [];
        $('.cell[id^="r_"]').each((index, element) => {
            const $el = $(element);
            const replyId = $el.attr('id') ? $el.attr('id').replace('r_', '') : '';

            // 提取回复人信息
            const replyAuthorElement = $el.find('strong a.dark');
            const replyAuthorName = replyAuthorElement.text().trim();
            const replyAuthorId = replyAuthorElement.attr('href') ? replyAuthorElement.attr('href').replace('/member/', '') : '';
            const replyAuthorAvatar = $el.find('img.avatar').attr('src') || '';

            // 提取回复内容（保持原始换行格式）
            const replyContentElement = $el.find('.reply_content');
            let replyContent = '';
            if (replyContentElement.length > 0) {
                // 将HTML内容转换为文本，但保持换行符
                replyContent = replyContentElement.html()
                    .replace(/<br\s*\/?>/gi, '\n')  // 将 <br> 标签转换为换行符
                    .replace(/<[^>]*>/g, '')        // 移除其他HTML标签
                    .replace(/&nbsp;/g, ' ')        // 转换HTML实体
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .trim();
            }

            // 提取回复时间
            const replyTime = $el.find('.ago').attr('title') || $el.find('.ago').text().trim();

            // 提取回复楼层
            const replyFloor = $el.find('.no').text().trim();

            // 提取回复设备信息
            const deviceInfo = $el.find('.ago').text().trim();
            const deviceMatch = deviceInfo.match(/via (.+)$/);
            const device = deviceMatch ? deviceMatch[1] : '';

            // 提取回复中的Solana地址
            const solanaAddresses = this.extractSolanaAddressesFromText(replyContent);

            if (replyContent) {
                replies.push({
                    id: replyId,
                    floor: replyFloor,
                    author: {
                        name: replyAuthorName,
                        id: replyAuthorId,
                        avatar: replyAuthorAvatar
                    },
                    content: replyContent,
                    time: replyTime,
                    device: device,
                    solanaAddresses: solanaAddresses
                });
            }
        });

        // 构建帖子信息JSON
        const postInfo = {
            type: 'post',
            url: url,
            postId: postId,
            title: title,
            author: {
                name: authorName,
                id: authorId,
                avatar: authorAvatar
            },
            postTime: postTime,
            clickCount: clickCount,
            content: content,
            tags: tags,
            replyUserIds: replyUserIds,
            replies: replies,
            statistics: {
                replyCount: replies.length,
                totalFloors: replies.length + 1
            },
            parsedAt: new Date().toISOString()
        };

        return postInfo;
    }

    /**
     * 检测帖子的分页信息
     * @param {Object} $ - cheerio对象
     * @returns {Object} 分页信息
     */
    detectPagination($) {
        const pagination = {
            hasMultiplePages: false,
            totalPages: 1,
            currentPage: 1,
            pageUrls: []
        };

        // 查找分页导航
        const pageLinks = $('.page_normal, .page_current');
        if (pageLinks.length > 0) {
            pagination.hasMultiplePages = true;

            // 提取所有页码
            pageLinks.each((index, element) => {
                const $el = $(element);
                const href = $el.attr('href');
                const pageNum = $el.text().trim();

                if (href && pageNum) {
                    const pageUrl = href.startsWith('?') ? href : `?${href}`;
                    pagination.pageUrls.push({
                        page: parseInt(pageNum),
                        url: pageUrl
                    });
                }
            });

            // 查找当前页
            const currentPageElement = $('.page_current');
            if (currentPageElement.length > 0) {
                pagination.currentPage = parseInt(currentPageElement.text().trim());
            }

            // 计算总页数
            if (pagination.pageUrls.length > 0) {
                pagination.totalPages = Math.max(...pagination.pageUrls.map(p => p.page));
            }
        }

        return pagination;
    }

    /**
     * 抓取多页帖子的所有回复
     * @param {string} postId - 帖子ID
     * @param {Object} options - 解析选项
     * @returns {Promise<Object>} 包含所有页面的完整帖子信息
     */
    async parseMultiPagePost(postId, options = {}) {
        const baseUrl = `${this.baseUrl}/t/${postId}`;
        let allReplies = [];
        let allReplyUserIds = new Set();
        let postInfo = null;

        try {
            // 首先抓取第一页
            console.log(`📄 抓取第1页: ${baseUrl}`);
            const firstPageResponse = await axios.get(baseUrl, {
                headers: this.headers,
                timeout: options.timeout || 10000
            });

            const $first = cheerio.load(firstPageResponse.data);

            // 解析第一页基本信息
            postInfo = await this.parsePostPage($first, baseUrl, options);

            // 检测分页信息
            const pagination = this.detectPagination($first);
            console.log(`📊 检测到分页信息: 共${pagination.totalPages}页`);

            if (pagination.hasMultiplePages && pagination.totalPages > 1) {
                // 抓取所有其他页面
                for (let page = 2; page <= pagination.totalPages; page++) {
                    try {
                        const pageUrl = `${baseUrl}?p=${page}`;
                        console.log(`📄 抓取第${page}页: ${pageUrl}`);

                        const pageResponse = await axios.get(pageUrl, {
                            headers: this.headers,
                            timeout: options.timeout || 10000
                        });

                        const $page = cheerio.load(pageResponse.data);

                        // 提取该页的回复
                        const pageReplies = [];
                        $page('.cell[id^="r_"]').each((index, element) => {
                            const $el = $page(element);
                            const replyId = $el.attr('id') ? $el.attr('id').replace('r_', '') : '';

                            const replyAuthorElement = $el.find('strong a.dark');
                            const replyAuthorName = replyAuthorElement.text().trim();
                            const replyAuthorId = replyAuthorElement.attr('href') ? replyAuthorElement.attr('href').replace('/member/', '') : '';
                            const replyAuthorAvatar = $el.find('img.avatar').attr('src') || '';

                            // 提取回复内容（保持原始换行格式）
                            const replyContentElement = $el.find('.reply_content');
                            let replyContent = '';
                            if (replyContentElement.length > 0) {
                                replyContent = replyContentElement.html()
                                    .replace(/<br\s*\/?>/gi, '\n')
                                    .replace(/<[^>]*>/g, '')
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&quot;/g, '"')
                                    .trim();
                            }
                            const replyTime = $el.find('.ago').attr('title') || $el.find('.ago').text().trim();
                            const replyFloor = $el.find('.no').text().trim();

                            const deviceInfo = $el.find('.ago').text().trim();
                            const deviceMatch = deviceInfo.match(/via (.+)$/);
                            const device = deviceMatch ? deviceMatch[1] : '';

                            const solanaAddresses = this.extractSolanaAddressesFromText(replyContent);

                            if (replyContent) {
                                pageReplies.push({
                                    id: replyId,
                                    floor: replyFloor,
                                    author: {
                                        name: replyAuthorName,
                                        id: replyAuthorId,
                                        avatar: replyAuthorAvatar
                                    },
                                    content: replyContent,
                                    time: replyTime,
                                    device: device,
                                    solanaAddresses: solanaAddresses
                                });
                            }
                        });

                        // 合并回复
                        allReplies = allReplies.concat(pageReplies);

                        // 添加延迟避免请求过快
                        if (page < pagination.totalPages) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                    } catch (error) {
                        console.warn(`⚠️ 抓取第${page}页失败:`, error.message);
                    }
                }
            }

            // 合并所有回复
            const allRepliesCombined = postInfo.replies.concat(allReplies);

            // 从所有回复中提取唯一的回复人ID
            allReplyUserIds = new Set(postInfo.replyUserIds || []);
            allRepliesCombined.forEach(reply => {
                if (reply.author && reply.author.id) {
                    allReplyUserIds.add(reply.author.id);
                }
            });

            // 更新统计信息
            postInfo.replies = allRepliesCombined;
            postInfo.replyUserIds = Array.from(allReplyUserIds);
            postInfo.statistics.replyCount = allRepliesCombined.length;
            postInfo.statistics.totalFloors = allRepliesCombined.length + 1;
            postInfo.statistics.totalPages = pagination.totalPages;
            postInfo.pagination = pagination;

            console.log(`✅ 多页抓取完成: 共${allRepliesCombined.length}条回复，${pagination.totalPages}页，${postInfo.replyUserIds.length}个唯一回复人ID`);

        } catch (error) {
            throw new Error(`抓取多页帖子失败: ${error.message}`);
        }

        return postInfo;
    }

    /**
     * 从页面中提取Solana地址
     * @param {Object} $ - cheerio对象
     * @returns {string|null} Solana地址
     */
    extractSolanaAddress($) {
        // 方法1: 从script标签中提取
        const scriptContent = $('script').text();
        const addressMatch = scriptContent.match(/const address = "([A-Za-z0-9]{32-44})"/);
        if (addressMatch) {
            return addressMatch[1];
        }

        // 方法2: 从页面文本中查找Solana地址格式
        const pageText = $.text();
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
        const addresses = pageText.match(solanaAddressRegex);
        if (addresses && addresses.length > 0) {
            // 过滤掉可能的其他Base58编码字符串
            return addresses.find(addr => addr.length >= 32 && addr.length <= 44);
        }

        return null;
    }

    /**
     * 从JavaScript代码中提取回复人ID数组
     * @param {Object} $ - cheerio对象
     * @returns {Array<string>} 回复人ID数组
     */
    extractReplyUserIds($) {
        const scriptContent = $('script').text();

        // 查找包含回复人ID数组的JavaScript代码
        // 使用更灵活的正则表达式来匹配可能跨多行的数组
        const wordsMatch = scriptContent.match(/var\s+words\s*=\s*(\[[^\]]*\]);/);
        if (wordsMatch) {
            try {
                // 尝试解析JavaScript数组
                const wordsString = wordsMatch[1];
                // 移除可能的引号和空格，然后分割
                const cleanString = wordsString.replace(/['"]/g, '').replace(/\[|\]/g, '');
                const userIds = cleanString.split(',').map(id => id.trim()).filter(id => id);
                console.log('✅ 成功从JavaScript中提取回复人ID:', userIds.length, '个');
                return userIds;
            } catch (error) {
                console.warn('Failed to parse reply user IDs:', error.message);
            }
        }

        // 如果第一种方法失败，尝试更宽松的匹配
        const wordsMatch2 = scriptContent.match(/words\s*=\s*(\[[^\]]*\]);/);
        if (wordsMatch2) {
            try {
                const wordsString = wordsMatch2[1];
                const cleanString = wordsString.replace(/['"]/g, '').replace(/\[|\]/g, '');
                const userIds = cleanString.split(',').map(id => id.trim()).filter(id => id);
                console.log('✅ 成功从JavaScript中提取回复人ID (方法2):', userIds.length, '个');
                return userIds;
            } catch (error) {
                console.warn('Failed to parse reply user IDs with second method:', error.message);
            }
        }

        // 如果无法从JavaScript中提取，则从HTML中提取
        const userIds = [];
        $('.cell[id^="r_"] strong a.dark').each((index, element) => {
            const href = $(element).attr('href');
            if (href) {
                const userId = href.replace('/member/', '');
                if (userId && !userIds.includes(userId)) {
                    userIds.push(userId);
                }
            }
        });

        if (userIds.length > 0) {
            console.log('✅ 从HTML中提取回复人ID:', userIds.length, '个');
        } else {
            console.log('⚠️ 无法从JavaScript或HTML中提取回复人ID');
            // 调试信息：显示找到的script标签数量
            const scriptCount = $('script').length;
            console.log('📊 找到script标签数量:', scriptCount);

            // 显示第一个script标签的内容片段
            const firstScript = $('script').first().text().substring(0, 200);
            console.log('📝 第一个script标签内容片段:', firstScript);
        }

        return userIds;
    }

    /**
     * 从文本中提取Solana地址
     * @param {string} text - 要解析的文本
     * @returns {Array<string>} Solana地址数组
     */
    extractSolanaAddressesFromText(text) {
        if (!text) return [];

        // 保持换行符作为分隔符，只清理多余的空格
        // 将换行符替换为空格，但保持作为地址分隔的作用
        const cleanedText = text
            .replace(/\r\n/g, ' ')  // Windows换行符
            .replace(/\n/g, ' ')    // Unix换行符
            .replace(/\r/g, ' ')    // Mac换行符
            .replace(/\s+/g, ' ')   // 多个空格替换为单个空格
            .trim();

        // 新的智能Solana地址提取方法
        let addresses = [];

        // 方法1: 按空格分割文本，独立检查每个token
        const tokens = cleanedText.split(' ');

        for (const token of tokens) {
            if (!token) continue;

            // 检查token是否可能包含Solana地址
            if (token.length >= 32) {
                // 尝试从token中提取Solana地址
                const possibleAddresses = this.extractAddressesFromToken(token);
                addresses.push(...possibleAddresses);
            }
        }

        // 方法2: 如果按token提取失败，回退到原始正则表达式匹配
        if (addresses.length === 0) {
            const fallbackMatches = cleanedText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
            addresses = fallbackMatches.filter(addr =>
                addr.length >= 32 && addr.length <= 44 && !/^\d+$/.test(addr)
            );
        }

        if (addresses) {
            // 过滤和验证地址
            const validAddresses = addresses.filter(addr => {
                // 确保地址长度在合理范围内
                if (addr.length < 32 || addr.length > 60) return false;

                // 过滤掉明显不是Solana地址的字符串
                // 避免匹配纯数字
                if (/^\d+$/.test(addr)) return false;

                // 确保地址以Base58字符开头
                if (!/^[1-9A-HJ-NP-Za-km-z]/.test(addr)) return false;

                return true;
            });

            // 去重
            const uniqueAddresses = [...new Set(validAddresses)];

            if (uniqueAddresses.length > 0) {
                console.log(`🔍 从文本中提取到 ${uniqueAddresses.length} 个Solana地址:`, uniqueAddresses);
            }

            return uniqueAddresses;
        }

        return [];
    }

    /**
     * 从单个token中提取Solana地址
     * @param {string} token - 要解析的token
     * @returns {Array<string>} Solana地址数组
     */
    extractAddressesFromToken(token) {
        if (!token || token.length < 32) return [];

        const addresses = [];

        // 情况1: token本身就是Solana地址
        if (this.isValidSolanaAddress(token)) {
            addresses.push(token);
            return addresses;
        }

        // 情况2: token包含前缀，尝试找到地址部分
        // 查找连续的Base58字符，长度在32-44之间
        const addressMatch = token.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (addressMatch && this.isValidSolanaAddress(addressMatch[0])) {
            addresses.push(addressMatch[0]);
            return addresses;
        }

        // 情况3: token以数字开头，尝试找到以字母开头的地址
        if (/^\d/.test(token)) {
            const letterMatch = token.match(/[A-HJ-NP-Za-km-z][1-9A-HJ-NP-Za-km-z]{31,43}/);
            if (letterMatch && this.isValidSolanaAddress(letterMatch[0])) {
                addresses.push(letterMatch[0]);
                return addresses;
            }
        }

        return addresses;
    }

    /**
     * 验证是否为有效的Solana地址
     * @param {string} address - 要验证的地址
     * @returns {boolean} 是否为有效地址
     */
    isValidSolanaAddress(address) {
        if (!address || typeof address !== 'string') return false;

        // 长度检查
        if (address.length < 32 || address.length > 44) return false;

        // Base58字符检查
        if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) return false;

        // 排除纯数字
        if (/^\d+$/.test(address)) return false;

        return true;
    }

    /**
     * 批量解析多个V2EX页面
     * @param {Array<string>} urls - V2EX页面URL数组
     * @param {Object} options - 解析选项
     * @returns {Promise<Array>} 解析结果数组
     */
    async parseMultiplePages(urls, options = {}) {
        const results = [];

        for (const url of urls) {
            try {
                const result = await this.parseV2exPage(url, options);
                results.push({
                    url: url,
                    success: true,
                    data: result
                });
            } catch (error) {
                results.push({
                    url: url,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return results;
    }

    /**
     * 解析用户信息页面（便捷方法）
     * @param {string} username - 用户名
     * @param {Object} options - 解析选项
     * @returns {Promise<Object>} 用户信息JSON
     */
    async parseUserInfo(username, options = {}) {
        const url = `${this.baseUrl}/member/${username}`;
        return await this.parseV2exPage(url, options);
    }

    /**
     * 解析帖子页面（便捷方法）
     * @param {string} postId - 帖子ID
     * @param {Object} options - 解析选项
     * @returns {Promise<Object>} 帖子信息JSON
     */
    async parsePost(postId, options = {}) {
        // 默认使用多页抓取
        const useMultiPage = options.useMultiPage !== false; // 默认启用

        if (useMultiPage) {
            return await this.parseMultiPagePost(postId, options);
        } else {
            const url = `${this.baseUrl}/t/${postId}`;
            return await this.parseV2exPage(url, options);
        }
    }

    /**
     * 批量解析用户名信息
     * @param {Array<string>} usernames - 用户名数组
     * @param {Object} options - 解析选项
     * @returns {Promise<Array>} 用户信息数组
     */
    async parseMultipleUsers(usernames, options = {}) {
        const results = [];
        const totalUsers = usernames.length;

        console.log(`🚀 开始批量解析 ${totalUsers} 个用户信息...`);

        // 设置默认选项
        const defaultOptions = {
            timeout: 10000,
            delay: 1000, // 请求间隔延迟（毫秒）
            retryCount: 2, // 失败重试次数
            showProgress: true // 是否显示进度
        };

        const finalOptions = { ...defaultOptions, ...options };

        for (let i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            const currentIndex = i + 1;

            if (finalOptions.showProgress) {
                console.log(`📊 进度: ${currentIndex}/${totalUsers} - 正在解析用户: ${username}`);
            }

            let retryAttempts = 0;
            let success = false;

            while (retryAttempts <= finalOptions.retryCount && !success) {
                try {
                    const userInfo = await this.parseUserInfo(username, finalOptions);

                    results.push({
                        username: username,
                        success: true,
                        data: userInfo,
                        timestamp: new Date().toISOString()
                    });

                    success = true;

                    if (finalOptions.showProgress) {
                        console.log(`✅ 用户 ${username} 解析成功`);
                    }

                } catch (error) {
                    retryAttempts++;

                    if (retryAttempts <= finalOptions.retryCount) {
                        if (finalOptions.showProgress) {
                            console.log(`⚠️ 用户 ${username} 解析失败，第 ${retryAttempts} 次重试...`);
                        }
                        // 重试前等待一段时间
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        if (finalOptions.showProgress) {
                            console.log(`❌ 用户 ${username} 解析最终失败: ${error.message}`);
                        }

                        results.push({
                            username: username,
                            success: false,
                            error: error.message,
                            retryAttempts: retryAttempts,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }

            // 请求间隔延迟，避免请求过快
            if (i < usernames.length - 1 && finalOptions.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, finalOptions.delay));
            }
        }

        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`\n📊 批量解析完成！`);
        console.log(`✅ 成功: ${successCount} 个`);
        console.log(`❌ 失败: ${failureCount} 个`);
        console.log(`📈 成功率: ${((successCount / totalUsers) * 100).toFixed(2)}%`);

        return results;
    }

    /**
     * 从用户名数组创建用户信息URL数组
     * @param {Array<string>} usernames - 用户名数组
     * @returns {Array<string>} 用户信息URL数组
     */
    createUserUrls(usernames) {
        return usernames.map(username => `${this.baseUrl}/member/${username}`);
    }

    /**
     * 批量解析用户名信息（使用URL方式）
     * @param {Array<string>} usernames - 用户名数组
     * @param {Object} options - 解析选项
     * @returns {Promise<Array>} 用户信息数组
     */
    async parseMultipleUsersByUrls(usernames, options = {}) {
        const urls = this.createUserUrls(usernames);
        return await this.parseMultiplePages(urls, options);
    }

    /**
     * 设置基础URL
     * @param {string} baseUrl - 新的基础URL
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        console.log(`🔧 基础URL已更新为: ${this.baseUrl}`);
    }

    /**
     * 获取当前基础URL
     * @returns {string} 当前基础URL
     */
    getBaseUrl() {
        return this.baseUrl;
    }
}

// 导出类
module.exports = V2exParser;

// 创建默认实例
const parser = new V2exParser();

// 导出便捷函数
module.exports.parseV2exPage = (url, options) => parser.parseV2exPage(url, options);
module.exports.parseUserInfo = (username, options) => parser.parseUserInfo(username, options);
module.exports.parsePost = (postId, options) => parser.parsePost(postId, options);
module.exports.parseMultiPagePost = (postId, options) => parser.parseMultiPagePost(postId, options);
module.exports.parseMultiplePages = (urls, options) => parser.parseMultiplePages(urls, options);
module.exports.parseMultipleUsers = (usernames, options) => parser.parseMultipleUsers(usernames, options);
module.exports.parseMultipleUsersByUrls = (usernames, options) => parser.parseMultipleUsersByUrls(usernames, options);
module.exports.setBaseUrl = (baseUrl) => parser.setBaseUrl(baseUrl);
module.exports.getBaseUrl = () => parser.getBaseUrl();
