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
                    <q-card-section>
                        <div class="text-h6">本地資料庫</div>
                    </q-card-section>
                    <q-card-section>
                        <q-table :rows="localData" :columns="columns" row-key="_id" :loading="localLoading" v-model:pagination="localPagination">
                            <template v-slot:loading>
                                <q-inner-loading showing color="primary" />
                            </template>
                        </q-table>
                    </q-card-section>
                </q-card>
            </div>

            <!-- 遠端資料表 -->
            <div class="col-12 col-md-6">
                <q-card>
                    <q-card-section>
                        <div class="text-h6">遠端資料庫</div>
                    </q-card-section>
                    <q-card-section>
                        <q-table :rows="remoteData" :columns="columns" row-key="_id" :loading="remoteLoading" v-model:pagination="remotePagination">
                            <template v-slot:loading>
                                <q-inner-loading showing color="primary" />
                            </template>
                        </q-table>
                    </q-card-section>
                </q-card>
            </div>
        </div>
    </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';

const localData = ref([]);
const remoteData = ref([]);
const localLoading = ref(true);
const remoteLoading = ref(true);
const isSyncing = ref(false);
const syncStatus = ref('idle'); // 'idle', 'syncing', 'error', 'completed'
const lastSyncTime = ref(null);

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
    rowsPerPage: 10
});
const remotePagination = ref({
    rowsPerPage: 10
});

// 表格欄位定義
const columns = [
    {
        name: 'courseId',
        required: true,
        label: '課程 ID',
        align: 'left',
        field: row => row.courseId || row._id,
        sortable: true
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
        sortable: true
    },
    {
        name: 'timestamp',
        align: 'right',
        label: '更新日期',
        field: row => (row.timestamp ? new Date(row.timestamp).toLocaleString() : '無記錄'),
        sortable: true
    }
];

// 監聽同步狀態更新
let syncMessageListener = null;

const setupSyncMessageListener = () => {
    syncMessageListener = message => {
        if (message.type === 'syncStatus') {
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
        }
    };

    chrome.runtime.onMessage.addListener(syncMessageListener);
};

// 在組件卸載時移除監聽器
onUnmounted(() => {
    if (syncMessageListener) {
        chrome.runtime.onMessage.removeListener(syncMessageListener);
    }
});

// 觸發同步
const triggerSync = () => {
    isSyncing.value = true;
    syncStatus.value = 'syncing';

    chrome.runtime.sendMessage({ action: 'triggerSync' }, response => {
        // 背景腳本會透過 onMessage 事件通知同步狀態
        if (response && response.error) {
            syncStatus.value = 'error';
            isSyncing.value = false;
        }
    });
};

// 獲取本地資料庫數據
const fetchLocalData = async () => {
    localLoading.value = true;
    try {
        // 使用 chrome.runtime.sendMessage 獲取本地數據
        chrome.runtime.sendMessage({ action: 'getAllLocalDocs' }, response => {
            if (response && response.rows) {
                localData.value = response.rows.map(row => row.doc);
            }
            localLoading.value = false;
        });
    } catch (error) {
        console.error('獲取本地資料失敗:', error);
        localLoading.value = false;
    }
};

// 獲取遠端資料庫數據
const fetchRemoteData = async () => {
    remoteLoading.value = true;
    try {
        // 使用 chrome.runtime.sendMessage 獲取遠端數據
        chrome.runtime.sendMessage({ action: 'getAllRemoteDocs' }, response => {
            if (response && response.rows) {
                remoteData.value = response.rows.map(row => row.doc);
            }
            remoteLoading.value = false;
        });
    } catch (error) {
        console.error('獲取遠端資料失敗:', error);
        remoteLoading.value = false;
    }
};

// 獲取上次同步時間
const fetchLastSyncTime = () => {
    chrome.runtime.sendMessage({ action: 'getLastSyncTime' }, response => {
        if (response && response.time) {
            lastSyncTime.value = new Date(response.time);
        }
    });
};

onMounted(() => {
    setupSyncMessageListener();
    fetchLocalData();
    fetchRemoteData();
    fetchLastSyncTime();
});
</script>
