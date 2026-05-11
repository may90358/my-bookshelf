const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID.replace(/-/g, '');

async function fetchBooks() {
  try {
    console.log(`正在抓取資料庫內容...`);
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: 'Reading Status', select: { equals: 'Finished' } }
    });

    const books = await Promise.all(response.results.map(async (page) => {
      const p = page.properties;
      const pageId = page.id;

      // 1. 抓取心得 (最新的一條評論)
      const commentsRes = await notion.comments.list({ block_id: pageId });
      const lastComment = commentsRes.results[0]?.rich_text.map(t => t.plain_text).join('') || "尚無心得";

      // 2. 抓取劃線句子 (抓取頁面中所有的 Callout 或 Quote 區塊，或是純文字)
      const blocksRes = await notion.blocks.children.list({ block_id: pageId });
      const highlights = blocksRes.results
        .filter(block => ['callout', 'quote', 'paragraph'].includes(block.type))
        .map(block => {
          const textArr = block[block.type].rich_text;
          return textArr ? textArr.map(t => t.plain_text).join('') : "";
        })
        .filter(text => text.length > 5) // 過濾掉太短的空白行
        .join('\n\n---\n\n');

      const fullNote = `【我的心得】\n${lastComment}\n\n【書中金句】\n${highlights}`;

      return {
        title: p['Name']?.title[0]?.plain_text || '無標題',
        author: p['Author']?.rich_text[0]?.plain_text || '未知作者',
        rating: p['Rating']?.select?.name || '★★★★★',
        year: p['Date Finished']?.date?.start ? new Date(p['Date Finished'].date.start).getFullYear() : 2026,
        color: ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad'][Math.floor(Math.random() * 5)],
        note: fullNote,
        height: 180 + Math.floor(Math.random() * 50),
        width: 35 + Math.floor(Math.random() * 15)
      };
    }));

    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log(`✅ 抓取成功！包含心得與金句。`);
  } catch (error) {
    console.error('❌ 抓取失敗:', error.message);
    process.exit(1);
  }
}

fetchBooks();
