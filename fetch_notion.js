const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

async function fetchBooks() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Reading Status', // 只抓取標記為 Finished 的書
        status: { equals: 'Finished' }
      }
    });

    const books = response.results.map(page => {
      const p = page.properties;
      
      // 處理日期與年份
      const dateVal = p['Date Finished']?.date?.start;
      const year = dateVal ? new Date(dateVal).getFullYear() : 2026;

      // 處理顏色（根據 Genre 或是隨機）
      const colors = ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#d35400'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      return {
        title: p['Name']?.title[0]?.plain_text || '無標題',
        author: p['Author']?.rich_text[0]?.plain_text || '未知作者',
        rating: p['Rating']?.select?.name || '★★★★★',
        year: year,
        color: randomColor,
        note: "（這是自動抓取的筆記範本，你可以在 Notion 增加 Note 欄位來替換這段文字）",
        height: 180 + Math.floor(Math.random() * 50),
        width: 35 + Math.floor(Math.random() * 15)
      };
    });

    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log('✅ books.json 更新成功！');
  } catch (error) {
    console.error('❌ 抓取失敗:', error);
    process.exit(1);
  }
}

fetchBooks();
