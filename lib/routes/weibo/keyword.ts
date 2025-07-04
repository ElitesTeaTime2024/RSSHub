import { Route, ViewType } from '@/types';
import cache from '@/utils/cache';
import querystring from 'node:querystring';
import got from '@/utils/got';
import weiboUtils from './utils';
import timezone from '@/utils/timezone';
import { fallback, queryToBoolean } from '@/utils/readable-social';
import { config } from '@/config';

export const route: Route = {
    path: '/keyword/:keyword/:routeParams?',
    categories: ['social-media'],
    view: ViewType.SocialMedia,
    example: '/weibo/keyword/RSSHub',
    parameters: { keyword: '你想订阅的微博关键词', routeParams: '额外参数；请参阅上面的说明和表格' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '关键词',
    maintainers: ['DIYgod', 'Rongronggg9'],
    handler,
};

async function handler(ctx) {
    const keyword = ctx.req.param('keyword');
    const routeParams = querystring.parse(ctx.req.param('routeParams'));

    const page = Math.max(1, Number.parseInt(String(routeParams.page), 10) || 1);

    const data = await cache.tryGet(
        `weibo:keyword:${keyword}:page:${page}`,
        async () => {
            const apiUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D61%26q%3D${encodeURIComponent(keyword)}%26t%3D0&page=${page}`; // 3. เพิ่ม page เข้าไปใน URL
            const _r = await got({
                method: 'get',
                url: apiUrl,
                headers: {
                    Referer: `https://m.weibo.cn/p/searchall?containerid=100103type%3D1%26q%3D${encodeURIComponent(keyword)}`, // Referer อาจจะไม่จำเป็นต้องมี page
                    'MWeibo-Pwa': 1,
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
                },
            });
            return _r.data.data.cards;
        },
        config.cache.routeExpire,
        false
    );

    const feedTitle = `又有人在微博提到${keyword}了${page > 1 ? ` (第 ${page} 页)` : ''}`;

    return weiboUtils.sinaimgTvax({
        title: feedTitle,
        link: `http://s.weibo.com/weibo/${encodeURIComponent(keyword)}&b=1&nodup=1`,
        description: feedTitle,
        item: data
            .filter((i) => i.mblog)
            .map((item) => {
                item.mblog.created_at = timezone(item.mblog.created_at, +8);
                if (item.mblog.retweeted_status && item.mblog.retweeted_status.created_at) {
                    item.mblog.retweeted_status.created_at = timezone(item.mblog.retweeted_status.created_at, +8);
                }
                return weiboUtils.formatExtended(ctx, item.mblog, undefined, {
                    showAuthorInTitle: fallback(undefined, queryToBoolean(routeParams.showAuthorInTitle), true),
                    showAuthorInDesc: fallback(undefined, queryToBoolean(routeParams.showAuthorInDesc), true),
                });
            }),
    });
}
