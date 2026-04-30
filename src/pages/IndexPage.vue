<template>
    <q-page class="flex flex-center bg-grey-1">
        <div class="text-center q-pa-lg">
            <!-- Foxina Logo -->
            <div class="q-mb-xl animate-pop">
                <q-img src="img/foxina.png" style="width: 280px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.1));" />
            </div>

            <!-- Title -->
            <h1 class="text-h3 text-weight-bold q-mb-md text-primary tracking-tight">Foxina : 狐狸小槍手</h1>
            <p class="text-subtitle1 text-grey-7 q-mb-xl">智能課程自動化工具，為您節省寶貴時間</p>

            <!-- Statistics Cards -->
            <div class="row q-col-gutter-lg justify-center">
                <!-- Courses Count Card -->
                <div class="col-12 col-sm-auto">
                    <q-card flat bordered class="stat-card hover-lift overflow-hidden">
                        <q-card-section class="q-pa-lg">
                            <div class="row items-center no-wrap">
                                <q-icon name="school" color="primary" size="3rem" class="q-mr-md" />
                                <div class="text-left">
                                    <div class="text-caption text-uppercase text-weight-medium text-grey-6 tracking-widest">目前支持課程</div>
                                    <div class="text-h3 text-weight-bold text-primary">
                                        <q-spinner-dots v-if="loading" color="primary" size="20px" />
                                        <span v-else>{{ supportedCoursesCount }}</span>
                                    </div>
                                </div>
                            </div>
                        </q-card-section>
                        <div class="bg-primary-fade q-py-xs"></div>
                    </q-card>
                </div>

                <!-- Questions Count Card -->
                <div class="col-12 col-sm-auto">
                    <q-card flat bordered class="stat-card hover-lift overflow-hidden">
                        <q-card-section class="q-pa-lg">
                            <div class="row items-center no-wrap">
                                <q-icon name="quiz" color="secondary" size="3rem" class="q-mr-md" />
                                <div class="text-left">
                                    <div class="text-caption text-uppercase text-weight-medium text-grey-6 tracking-widest">目前總題庫數量</div>
                                    <div class="text-h3 text-weight-bold text-secondary">
                                        <q-spinner-dots v-if="loading" color="secondary" size="20px" />
                                        <span v-else>{{ totalQuestionsCount }}</span>
                                    </div>
                                </div>
                            </div>
                        </q-card-section>
                        <div class="bg-secondary-fade q-py-xs"></div>
                    </q-card>
                </div>
            </div>

        </div>
    </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const remoteData = ref([]);
const loading = ref(true);

/**
 * 獲取遠端資料庫數據並計算統計資訊
 */
const fetchStats = async () => {
    loading.value = true;
    try {
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'getAllRemoteDocs' }, result => {
                if (chrome.runtime.lastError) {
                    console.error('Fetch error:', chrome.runtime.lastError);
                    resolve({ rows: [] });
                } else {
                    resolve(result || { rows: [] });
                }
            });
        });

        if (response && response.rows) {
            remoteData.value = response.rows.map(row => row.doc);
        }
    } catch (error) {
        console.error('統計數據獲取失敗:', error);
    } finally {
        loading.value = false;
    }
};

/** 支持的課程總數 */
const supportedCoursesCount = computed(() => remoteData.value.length);

/** 所有課程中的題目總數 */
const totalQuestionsCount = computed(() => {
    return remoteData.value.reduce((sum, doc) => {
        return sum + (doc.Q ? Object.keys(doc.Q).length : 0);
    }, 0);
});

onMounted(() => {
    fetchStats();
});
</script>

<style scoped>
.stat-card {
    border-radius: 16px;
    background: white;
    min-width: 280px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
}

.hover-lift:hover {
    transform: translateY(-8px);
    box-shadow: 0 15px 30px rgba(0,0,0,0.08) !important;
}

.bg-primary-fade {
    background: linear-gradient(90deg, var(--q-primary), transparent);
    opacity: 0.1;
}

.bg-secondary-fade {
    background: linear-gradient(90deg, var(--q-secondary), transparent);
    opacity: 0.1;
}

.tracking-tight {
    letter-spacing: -0.05em;
}

.tracking-widest {
    letter-spacing: 0.1em;
}

.animate-pop {
    animation: pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
}
</style>
