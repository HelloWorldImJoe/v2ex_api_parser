# V2EX API Parser

专门用于解析 V2EX 帖子内容的 npm 包，支持提取发帖人信息、ID、标题和回复内容。

## 功能特性

- 解析 V2EX 用户信息页面
- 解析 V2EX 帖子页面和回复内容
- 支持多页帖子抓取
- 批量用户信息解析
- 自动重试和错误处理
- 可配置的请求间隔和超时设置

## 安装

```bash
npm install v2ex-api-parser
```

## 基本用法

### 解析用户信息

```javascript
const { parseUserInfo } = require("v2ex-api-parser");

// 解析单个用户
const userInfo = await parseUserInfo("Livid");
console.log(userInfo);
```

### 解析帖子内容

```javascript
const { parsePost } = require("v2ex-api-parser");

// 解析帖子（默认使用多页抓取）
const postInfo = await parsePost("1153351");

// 或者禁用多页抓取，只抓取第一页
const postInfoSinglePage = await parsePost("1153351", {
  useMultiPage: false,
});

console.log(postInfo);
```

### 多页帖子解析

```javascript
const { parseMultiPagePost } = require("v2ex-api-parser");

// 解析多页帖子
const multiPageInfo = await parseMultiPagePost("1153351", {
  showProgress: true,
  timeout: 10000,
});
console.log(multiPageInfo);
```

### 批量用户解析

```javascript
const { parseMultipleUsers } = require("v2ex-api-parser");

// 批量解析用户
const users = await parseMultipleUsers(["Livid", "acros", "Kai"], {
  showProgress: true,
  delay: 1000,
  retryCount: 2,
});
console.log(users);
```

## 高级用法

### 自定义配置

```javascript
const V2exParser = require("v2ex-api-parser");

const parser = new V2exParser({
  baseUrl: "https://global.v2ex.co",
  timeout: 15000,
});

// 设置基础URL
parser.setBaseUrl("https://global.v2ex.co");

// 解析页面
const result = await parser.parseV2exPage(
  "https://global.v2ex.co/member/Livid"
);
```

### 解析选项

```javascript
const options = {
  showProgress: true, // 显示进度
  delay: 1000, // 请求间隔(毫秒)
  retryCount: 2, // 重试次数
  timeout: 10000, // 超时时间
  useMultiPage: true, // 是否使用多页抓取(parsePost方法)
};
```

## 返回数据格式

### 用户信息

```javascript
{
  username: "Livid",
  memberId: "1",
  joinTime: "2010-04-25 21:45:46",
  activeRank: "226",
  signature: "Remember the bigger green...",
  solanaAddress: "4DmZnXBzRzZpHmRhDSyGzZrMStPkw7DzpzwuC9X2w6AR",
  recentReplies: 8,
}
```

### 帖子信息

```javascript
{
  type: "post",
  url: "https://v2ex.com/t/1153351",
  postId: "1153351",
  title: "帖子标题",
  author: {
    name: "作者名",
    id: "作者ID",
    avatar: "头像URL"
  },
  postTime: "发布时间",
  clickCount: "点击次数",
  content: "帖子内容",
  tags: ["标签1", "标签2"],
  replyUserIds: ["回复者ID1", "回复者ID2"],
  replies: [
    {
      id: "回复ID",
      floor: "楼层号",
      author: {
        name: "回复者名",
        id: "回复者ID",
        avatar: "头像URL"
      },
      content: "回复内容",
      time: "回复时间",
      device: "设备信息",
      solanaAddresses: ["Solana地址1", "Solana地址2"]
    }
  ],
  statistics: {
    replyCount: 16,
    totalFloors: 17
  },
  pagination: {
    hasMultiplePages: false,
    totalPages: 1,
    currentPage: 1
  },
  parsedAt: "2024-01-01T00:00:00.000Z"
}
```

## 测试

```bash
# 运行所有测试
npm run test:all

# 运行主要测试
npm test

# 运行批量用户测试
npm run test:batch
```

## 发布

```bash
# 发布补丁版本
npm run publish:patch

# 发布次要版本
npm run publish:minor

# 发布主要版本
npm run publish:major
```

## 许可证

MIT
