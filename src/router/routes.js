const routes = [
    {
        path: '/',
        component: () => import('layouts/MainLayout.vue'),
        children: [{ path: '', component: () => import('pages/IndexPage.vue') }]
    },
    {
        path: '/whatsnew',
        component: () => import('layouts/whatsNewLayout.vue'),
        children: [{ path: '', component: () => import('pages/whatsNewPage.vue') }]
    },
    {
        path: '/popup',
        component: () => import('layouts/SingleColumnLayout.vue'),
        children: [{ path: '', component: () => import('pages/bexPopupPage.vue') }],
        meta: { popup: true } // 添加 meta 属性以标识为弹出窗口路由
    },
    {
        path: '/options',
        component: () => import('layouts/SingleColumnLayout.vue'),
        children: [{ path: '', component: () => import('pages/bexPopupPage.vue') }],
        meta: { popup: true } // 添加 meta 属性以标识为弹出窗口路由
    },

    // Always leave this as last one,
    // but you can also remove it
    {
        path: '/:catchAll(.*)*',
        component: () => import('pages/ErrorNotFound.vue')
    }
];

export default routes;
