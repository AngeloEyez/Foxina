<template>
    <q-page class="q-pa-md">
        <div class="text-h5 q-mb-md">Foxina Dashboard</div>

        <!-- 同步狀態和按鈕 -->
        <div class="row q-mb-md items-center">
            <div class="col">
                <div class="text-subtitle1">
                    同步狀態：
                    <q-badge :color="syncStatusColor">{{ syncStatusText }}</q-badge>
                </div>
                <div v-if="lastSyncTime" class="text-caption">上次同步時間：{{ lastSyncTime.toLocaleString() }}</div>
            </div>
            <div class="col-auto">
                <q-btn color="primary" label="同步資料" icon="sync" :loading="isSyncing" :disable="isSyncing" @click="triggerSync" />
            </div>
        </div>

        <div class="row q-col-gutter-md">
            <!-- 本地資料表 -->
            <div class="col-12 col-md-6">
                <q-card>
                    <q-card-section class="q-py-sm">
                        <div class="row items-center no-wrap">
                            <div class="text-h6 text-no-wrap">本地資料庫 ({{ localData.length }}筆資料)</div>
                            <q-space />
                            <q-input v-model="localFilter" dense outlined clearable placeholder="搜尋課程..." class="q-ml-md" style="max-width: 200px">
                                <template v-slot:append>
                                    <q-icon name="search" />
                                </template>
                            </q-input>
                            <q-btn flat round size="sm" icon="refresh" @click="fetchLocalData" :loading="localLoading" class="q-ml-xs">
                                <q-tooltip>刷新本地資料</q-tooltip>
                            </q-btn>
                        </div>
                    </q-card-section>
                    <q-card-section class="q-pa-none">
                        <q-table :rows="localData" :columns="columns" row-key="_id" :loading="localLoading" v-model:pagination="localPagination" :filter="localFilter" dense>
                            <template v-slot:loading>
                                <q-inner-loading showing color="primary" />
                            </template>
                            <template v-slot:body="props">
                                <q-tr :props="props">
                                    <!-- 課程ID -->
                                    <q-td key="courseId" :props="props" @click="openDetail(props.row)" class="cursor-pointer">
                                        {{ props.row.courseId || props.row._id }}
                                    </q-td>
                                    <!-- 課程標題 -->
                                    <q-td key="title" :props="props" @click="openCourseUrl(props.row)" class="cursor-pointer">
                                        {{ props.row._id }}
                                    </q-td>
                                    <!-- 題庫數量 -->
                                    <q-td key="questionCount" :props="props" class="text-center">
                                        {{ props.row.Q ? Object.keys(props.row.Q).length : 0 }}
                                    </q-td>
                                    <!-- 更新日期 -->
                                    <q-td key="timestamp" :props="props" class="text-right">
                                        {{ props.row.timestamp ? new Date(props.row.timestamp).toLocaleString() : new Date('2020-01-01').toLocaleString() }}
                                    </q-td>
                                    <!-- 操作 -->
                                    <q-td auto-width>
                                        <q-btn size="sm" flat round color="negative" icon="delete" @click.stop="confirmDelete(props.row, 'local')">
                                            <q-tooltip>刪除</q-tooltip>
                                        </q-btn>
                                    </q-td>
                                </q-tr>
                            </template>
                        </q-table>
                    </q-card-section>
                </q-card>
            </div>

            <!-- 遠端資料表 -->
            <div class="col-12 col-md-6">
                <q-card>
                    <q-card-section class="q-py-sm">
                        <div class="row items-center no-wrap">
                            <div class="text-h6 text-no-wrap">遠端資料庫 ({{ remoteData.length }}筆資料)</div>
                            <q-space />
                            <q-input v-model="remoteFilter" dense outlined clearable placeholder="搜尋課程..." class="q-ml-md" style="max-width: 200px">
                                <template v-slot:append>
                                    <q-icon name="search" />
                                </template>
                            </q-input>
                            <q-btn flat round size="sm" icon="refresh" @click="fetchRemoteData" :loading="remoteLoading" class="q-ml-xs">
                                <q-tooltip>刷新遠端資料</q-tooltip>
                            </q-btn>
                        </div>
                    </q-card-section>
                    <q-card-section class="q-pa-none">
                        <q-table :rows="remoteData" :columns="columns" row-key="_id" :loading="remoteLoading" v-model:pagination="remotePagination" :filter="remoteFilter" dense>
                            <template v-slot:loading>
                                <q-inner-loading showing color="primary" />
                            </template>
                            <template v-slot:body="props">
                                <q-tr :props="props">
                                    <!-- 課程ID -->
                                    <q-td key="courseId" :props="props" @click="openDetail(props.row)" class="cursor-pointer">
                                        {{ props.row.courseId || props.row._id }}
                                    </q-td>
                                    <!-- 課程標題 -->
                                    <q-td key="title" :props="props" @click="openCourseUrl(props.row)" class="cursor-pointer">
                                        {{ props.row._id }}
                                    </q-td>
                                    <!-- 題庫數量 -->
                                    <q-td key="questionCount" :props="props" class="text-center">
                                        {{ props.row.Q ? Object.keys(props.row.Q).length : 0 }}
                                    </q-td>
                                    <!-- 更新日期 -->
                                    <q-td key="timestamp" :props="props" class="text-right">
                                        {{ props.row.timestamp ? new Date(props.row.timestamp).toLocaleString() : new Date('2020-01-01').toLocaleString() }}
                                    </q-td>
                                    <!-- 操作 -->
                                    <!-- <q-td auto-width>
                                        <q-btn size="sm" flat round color="negative" icon="delete" @click.stop="confirmDelete(props.row, 'remote')">
                                            <q-tooltip>刪除</q-tooltip>
                                        </q-btn>
                                    </q-td> -->
                                </q-tr>
                            </template>
                        </q-table>
                    </q-card-section>
                </q-card>
            </div>
        </div>

        <!-- 刪除確認對話框 -->
        <q-dialog v-model="deleteConfirmShow">
            <q-card>
                <q-card-section class="row items-center">
                    <div class="text-h6">確認刪除</div>
                </q-card-section>
                <q-card-section>確定要刪除這個課程嗎？此操作無法撤銷。</q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="取消" color="primary" v-close-popup />
                    <q-btn flat label="刪除" color="negative" @click="deleteDoc" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>

        <!-- 課程詳細視圖對話框 -->
        <q-dialog v-model="detailDialogShow" maximized persistent>
            <q-card class="full-width">
                <q-card-section class="row items-center">
                    <div class="text-h6">課程詳細資訊</div>
                    <q-space />
                    <q-btn icon="close" flat round dense v-close-popup />
                </q-card-section>

                <q-separator />

                <q-card-section v-if="selectedCourse">
                    <div class="row q-mb-md">
                        <div class="col-12 col-md-6">
                            <div class="text-subtitle1">課程ID: {{ selectedCourse.courseId || selectedCourse._id }}</div>
                            <div class="text-subtitle1">課程標題: {{ selectedCourse._id }}</div>
                            <div class="text-subtitle1">更新日期: {{ selectedCourse.timestamp ? new Date(selectedCourse.timestamp).toLocaleString() : new Date('2020-01-01').toLocaleString() }}</div>
                        </div>
                    </div>

                    <q-card-section class="q-pt-none">
                        <div class="text-h6 q-mb-md">題庫列表 ({{ selectedCourse.Q ? Object.keys(selectedCourse.Q).length : 0 }}題)</div>
                        <div v-if="!selectedCourse.Q || Object.keys(selectedCourse.Q).length === 0" class="text-center q-pa-md">
                            <q-icon name="info" size="2rem" color="grey" />
                            <div class="text-grey">此課程暫無題庫資料</div>
                        </div>
                        <div v-else>
                            <q-table :rows="formatTopicData(selectedCourse.Q)" :columns="topicColumns" row-key="id" dense flat bordered :pagination="{ rowsPerPage: 0 }" hide-pagination />
                        </div>
                    </q-card-section>
                </q-card-section>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const localData = ref([]);
const remoteData = ref([]);
const localLoading = ref(true);
const remoteLoading = ref(true);
const localFilter = ref('');
const remoteFilter = ref('');
const isSyncing = ref(false);
const syncStatus = ref('idle'); // 'idle', 'syncing', 'error', 'completed'
const lastSyncTime = ref(null);

// 詳細視圖相關
const detailDialogShow = ref(false);
const selectedCourse = ref(null);

// 刪除相關
const deleteConfirmShow = ref(false);
const docToDelete = ref(null);
const deleteSource = ref('');

// 同步狀態計算屬性
const syncStatusText = computed(() => {
    switch (syncStatus.value) {
        case 'idle':
            return '空閒';
        case 'syncing':
            return '同步中';
        case 'error':
            return '同步錯誤';
        case 'completed':
            return '同步完成';
        default:
            return '未知';
    }
});

const syncStatusColor = computed(() => {
    switch (syncStatus.value) {
        case 'idle':
            return 'grey';
        case 'syncing':
            return 'blue';
        case 'error':
            return 'red';
        case 'completed':
            return 'green';
        default:
            return 'grey';
    }
});

// 設定表格分頁
const localPagination = ref({
    sortBy: 'timestamp',
    descending: true,
    rowsPerPage: 20
});
const remotePagination = ref({
    sortBy: 'timestamp',
    descending: true,
    rowsPerPage: 20
});

// 處理課程詳細資訊
const openDetail = row => {
    selectedCourse.value = row;
    detailDialogShow.value = true;
};

// 處理開啟課程網頁
const openCourseUrl = row => {
    const id = row.courseId || row._id;
    let url = '';

    // 判斷ID格式來選擇對應URL
    if (id && id.toString().length === 5) {
        url = `https://iedu.foxconn.com/public/play/play?courseId=${id}&companyId=1`;
    } else if (id && id.toString().length === 4) {
        url = `https://iedu.foxconn.com/public/play/examTaskUI?itemId=${id}`;
    } else {
        // 如果ID不符合條件，則打開詳細視圖
        openDetail(row);
        return;
    }

    // 在新標籤頁中打開URL
    chrome.tabs.create({ url });
};

// 確認刪除文檔
const confirmDelete = (row, source) => {
    docToDelete.value = row;
    deleteSource.value = source;
    deleteConfirmShow.value = true;
};

// 刪除文檔
const deleteDoc = () => {
    if (!docToDelete.value) return;

    const id = docToDelete.value._id;
    const rev = docToDelete.value._rev;

    if (!id || !rev) {
        $q.notify({
            color: 'negative',
            message: '缺少必要的文檔信息',
            icon: 'error'
        });
        return;
    }

    const action = deleteSource.value === 'local' ? 'deleteLocalDoc' : 'deleteRemoteDoc';

    chrome.runtime.sendMessage(
        {
            action,
            id,
            rev
        },
        response => {
            if (response && response.ok) {
                $q.notify({
                    color: 'positive',
                    message: `刪除成功`,
                    icon: 'check_circle'
                });

                // 刷新數據
                if (deleteSource.value === 'local') {
                    fetchLocalData();
                } else {
                    fetchRemoteData();
                }
            } else {
                $q.notify({
                    color: 'negative',
                    message: `刪除失敗: ${response ? response.error : '未知錯誤'}`,
                    icon: 'error'
                });
            }
        }
    );
};

// 表格欄位定義
const columns = [
    {
        name: 'courseId',
        required: true,
        label: '課程 ID',
        align: 'left',
        field: row => row.courseId || row._id,
        sortable: true,
        style: 'width: 100px'
    },
    {
        name: 'title',
        align: 'left',
        label: '課程標題',
        field: '_id',
        sortable: true
    },
    {
        name: 'questionCount',
        align: 'center',
        label: '題庫數量',
        field: row => (row.Q ? Object.keys(row.Q).length : 0),
        sortable: true,
        style: 'width: 60px'
    },
    {
        name: 'timestamp',
        align: 'right',
        label: '更新日期',
        field: row => {
            if (row.timestamp) {
                return row.timestamp; //new Date(row.timestamp).toLocaleString();
            } else {
                return 0; //new Date('2020-01-01').toLocaleString();
            }
        },
        sortable: true,
        style: 'width: 140px'
    }
];

// 詳細視圖中題庫表格的欄位定義
const topicColumns = [
    {
        name: 'index',
        required: true,
        label: '編號',
        align: 'center',
        field: 'index',
        sortable: true,
        style: 'width: 60px'
    },
    {
        name: 'question',
        align: 'left',
        label: '題目',
        field: 'question',
        sortable: false
    },
    {
        name: 'answer',
        align: 'left',
        label: '答案',
        field: 'answer',
        sortable: false,
        style: 'width: 20%'
    }
];

// 將題庫數據格式化為表格數據
const formatTopicData = topicsObj => {
    if (!topicsObj || typeof topicsObj !== 'object') return [];

    return Object.entries(topicsObj).map(([key, value], index) => {
        return {
            id: index,
            index: index + 1,
            question: key,
            answer: Array.isArray(value) ? value.join(', ') : value
        };
    });
};

// 監聽同步狀態更新
let syncMessageListener = null;

const setupSyncMessageListener = () => {
    // 避免重複添加監聽器
    if (syncMessageListener) {
        try {
            chrome.runtime.onMessage.removeListener(syncMessageListener);
        } catch (error) {
            console.error('移除舊監聽器失敗:', error);
        }
    }

    syncMessageListener = (message, sender, sendResponse) => {
        try {
            if (message && message.type === 'syncStatus') {
                console.log('收到同步狀態更新:', message.status);
                syncStatus.value = message.status;
                if (message.status === 'completed' || message.status === 'error') {
                    isSyncing.value = false;
                    if (message.status === 'completed') {
                        lastSyncTime.value = new Date();
                        // 重新獲取資料
                        fetchLocalData();
                        fetchRemoteData();
                    }
                }
                // 確保返回true以表示處理了消息
                sendResponse({ received: true });
                return true;
            }
        } catch (error) {
            console.error('處理同步狀態消息時出錯:', error);
        }
    };

    try {
        chrome.runtime.onMessage.addListener(syncMessageListener);
        console.log('同步狀態監聽器已設置');
    } catch (error) {
        console.error('添加消息監聽器失敗:', error);
    }
};

// 在組件卸載時移除監聽器
onUnmounted(() => {
    if (syncMessageListener) {
        try {
            chrome.runtime.onMessage.removeListener(syncMessageListener);
            console.log('同步狀態監聽器已移除');
        } catch (error) {
            console.error('移除監聽器失敗:', error);
        }
    }
});

/**
 * triggerSync
 * 同步按鈕點擊處理函式。
 * 改為呼叫 background.js 中的 pushDB() 精確比對與刪除流程。
 */
const triggerSync = () => {
    isSyncing.value = true;
    syncStatus.value = 'syncing';

    chrome.runtime.sendMessage({ action: 'triggerPushDB' }, response => {
        if (chrome.runtime.lastError) {
            console.error('[triggerSync] 發送訊息失敗:', chrome.runtime.lastError.message);
            syncStatus.value = 'error';
            isSyncing.value = false;
            $q.notify({ color: 'negative', message: '發送同步指令失敗', icon: 'error' });
            return;
        }
        if (response && response.error) {
            // 拋除過老同步鎖定的情況
            if (response.error.includes('尚未完成')) {
                $q.notify({ color: 'warning', message: '同步中，請稍候再試', icon: 'hourglass_top' });
            } else {
                $q.notify({ color: 'negative', message: `同步失敗: ${response.error}`, icon: 'error' });
            }
            syncStatus.value = 'error';
            isSyncing.value = false;
        }
        // 成功的結果會由 background 透過 broadcastSyncStatus 通知
    });
};

// 延遲初始化功能以避免連接錯誤
const initExtension = () => {
    // 延遲更長時間以確保背景腳本完全加載
    setTimeout(() => {
        console.log('開始初始化擴展...');

        // 設置監聽器
        setupSyncMessageListener();

        // 分階段請求數據以減少並發錯誤
        fetchLastSyncTime();

        // 再次延遲以確保前一個請求已完成
        setTimeout(() => {
            fetchLocalData();

            // 進一步延遲遠端數據獲取
            setTimeout(() => {
                fetchRemoteData();
                console.log('擴展初始化完成');
            }, 300);
        }, 300);
    }, 1000); // 延遲1000毫秒初始化
};

// 獲取本地資料庫數據
const fetchLocalData = async () => {
    localLoading.value = true;
    try {
        console.log('正在獲取本地資料...');

        // 使用Promise包裝chrome.runtime.sendMessage以更好控制錯誤
        const response = await new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ action: 'getAllLocalDocs' }, result => {
                    if (chrome.runtime.lastError) {
                        console.error('獲取本地資料時發生錯誤:', chrome.runtime.lastError);
                        resolve({ error: chrome.runtime.lastError });
                    } else {
                        resolve(result || { rows: [] });
                    }
                });
            } catch (error) {
                console.error('發送獲取本地資料請求時出現異常:', error);
                resolve({ error });
            }
        });

        if (response && response.rows && !response.error) {
            localData.value = response.rows.map(row => row.doc);
            console.log(`獲取到 ${localData.value.length} 筆本地資料`);
        } else if (response.error) {
            console.error('本地資料處理錯誤:', response.error);
        }
    } catch (error) {
        console.error('獲取本地資料失敗:', error);
    } finally {
        localLoading.value = false;
    }
};

// 獲取遠端資料庫數據
const fetchRemoteData = async () => {
    remoteLoading.value = true;
    try {
        console.log('正在獲取遠端資料...');

        // 使用Promise包裝chrome.runtime.sendMessage以更好控制錯誤
        const response = await new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ action: 'getAllRemoteDocs' }, result => {
                    if (chrome.runtime.lastError) {
                        console.error('獲取遠端資料時發生錯誤:', chrome.runtime.lastError);
                        resolve({ error: chrome.runtime.lastError });
                    } else {
                        resolve(result || { rows: [] });
                    }
                });
            } catch (error) {
                console.error('發送獲取遠端資料請求時出現異常:', error);
                resolve({ error });
            }
        });

        if (response && response.rows && !response.error) {
            remoteData.value = response.rows.map(row => row.doc);
            console.log(`獲取到 ${remoteData.value.length} 筆遠端資料`);
        } else if (response.error) {
            console.error('遠端資料處理錯誤:', response.error);
        }
    } catch (error) {
        console.error('獲取遠端資料失敗:', error);
    } finally {
        remoteLoading.value = false;
    }
};

// 獲取上次同步時間
const fetchLastSyncTime = async () => {
    try {
        console.log('正在獲取上次同步時間...');

        // 使用Promise包裝chrome.runtime.sendMessage以更好控制錯誤
        const response = await new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ action: 'getLastSyncTime' }, result => {
                    if (chrome.runtime.lastError) {
                        console.error('獲取同步時間時發生錯誤:', chrome.runtime.lastError);
                        resolve({ error: chrome.runtime.lastError });
                    } else {
                        resolve(result || {});
                    }
                });
            } catch (error) {
                console.error('發送獲取同步時間請求時出現異常:', error);
                resolve({ error });
            }
        });

        if (response && response.time && !response.error) {
            lastSyncTime.value = new Date(response.time);
            console.log('上次同步時間:', lastSyncTime.value);
        } else if (response.error) {
            console.error('同步時間處理錯誤:', response.error);
        }
    } catch (error) {
        console.error('獲取同步時間失敗:', error);
    }
};

onMounted(() => {
    initExtension();
});
</script>

<style>
.cursor-pointer {
    cursor: pointer;
}
</style>
