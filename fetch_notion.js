const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID.replace(/-/g, '');

async function fetchBooks() {
  try {
    console.log(`正在從資料庫抓取已讀完的書籍...`);
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Reading Status',
        select: { equals: 'Finished' }
      }
    });

    const books = await Promise.all(response.results.map(async (page) => {
      const p = page.properties;
      const pageId = page.id;

      // 1. 抓取書名 (從 Notion 頁面最上方的標題屬性抓取)
      const titleProperty = Object.values(p).find(prop => prop.id === 'title');
      const pageTitle = titleProperty?.title[0]?.plain_text || '無標題';

      // 2. 抓取心得 (從頁面最上方的「評論/留言」抓取最新的一條)
      let commentText = "尚無心得紀錄";
      try {
        const commentsRes = await notion.comments.list({ block_id: pageId });
        if (commentsRes.results.length > 0) {
          commentText = commentsRes.results[0].rich_text.map(t => t.plain_text).join('');
        }
      } catch (err) {
        console.log(`無法讀取 ${pageTitle} 的評論`);
      }

      // 3. 抓取劃線句子 (從頁面下方的內容區塊抓取 Callout, Quote, 或一般文字)
      let highlights = "";
      try {
        const blocksRes = await notion.blocks.children.list({ block_id: pageId });
        highlights = blocksRes.results
          .filter(block => ['callout', 'quote', 'paragraph'].includes(block.type))
          .map(block => {
            const textArr = block[block.type].rich_text;
            return textArr ? textArr.map(t => t.plain_text).join('') : "";
          })
          .filter(text => text.trim().length > 2) // 過濾掉空白行
          .join('\n\n---\n\n');
      } catch (err) {
        console.log(`無法讀取 ${pageTitle} 的頁面區塊`);
      }

      // 組合心得與金句
      const fullNote = `【我的心得】\n${commentText}${highlights ? '\n\n【劃線金句】\n' + highlights : ''}`;

      // 4. 處理日期、作者、評分
      const dateVal = p['Date Finished']?.date?.start;
      const year = dateVal ? new Date(dateVal).getFullYear() : 2026;
      const author = p['Author']?.rich_text[0]?.plain_text || '未知作者';
      const rating = p['Rating']?.select?.name || '★★★★★';

      // 隨機產生書脊顏色
      const colors = ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#16a085'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      return {
        title: pageTitle,
        author: author,
        rating: rating,
        year: year,
        color: randomColor,
        note: fullNote,
        height: 180 + Math.floor(Math.random() * 50),
        width: 35 + Math.floor(Math.random() * 15)
      };
    }));

    // 將資料寫入 books.json
    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log(`✅ 同步完成！共抓取 ${books.length} 本書籍資料。`);

  } catch (error) {
    console.error('❌ 發生錯誤:', error.message);
    process.exit(1);
  }
}

fetchBooks();
