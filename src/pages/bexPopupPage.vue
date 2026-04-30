<template>
    <q-page class="column">
        <div class="q-pa-md" style="max-width: 350px">
            <q-list bordered padding>
                <q-item clickable v-ripple @click="() => openUrlInBrowser('https://iedu.foxconn.com/')">富學寶典</q-item>
                <q-item tag="label" v-ripple>
                    <q-item-section side top>
                        <q-toggle v-model="opt.iedu.autoPlay" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>狐狸幫我上課</q-item-label>
                        <q-item-label caption>自動撥放課程影片，可多開視窗同時撥放，不建議超過四個。</q-item-label>
                    </q-item-section>
                </q-item>
                <q-item tag="label" v-ripple v-if="opt.iedu.autoPlay">
                    <q-item-section avatar top>
                        <!-- <q-icon name="subdirectory_arrow_right" color="gray" size="34px" /> -->
                    </q-item-section>
                    <q-item-section side top>
                        <q-toggle v-model="opt.iedu.mute" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>影片靜音</q-item-label>
                        <q-item-label caption>自動撥放影片時靜音</q-item-label>
                    </q-item-section>
                </q-item>
                <q-item tag="label" v-ripple>
                    <q-item-section side top>
                        <q-toggle v-model="opt.iedu.fillAns" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>狐狸幫我考試</q-item-label>
                        <q-item-label caption>線上題庫已知答案自動填入，未知答案於提交考題後，下一次會自動填入。</q-item-label>
                    </q-item-section>
                </q-item>

                <q-separator spaced />
                <q-item clickable v-ripple @click="() => openUrlInBrowser('https://elearning.efoxconn.com/')">E-Learning</q-item>
                <q-item tag="label" v-ripple>
                    <q-item-section side top>
                        <q-toggle v-model="opt.elearning.fillAns" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>狐狸幫我考試</q-item-label>
                        <q-item-label caption>自動填入答案。(若無效請按F5重新整理網頁)</q-item-label>
                    </q-item-section>
                </q-item>
            </q-list>
        </div>
    </q-page>
</template>

<script setup>
import { ref, onMounted, reactive, inject, watch } from 'vue';
import { useQuasar } from 'quasar';
import { defaultOptions } from '../../src-bex/foxinaOptions.js';

const $q = useQuasar();
const opt = reactive(JSON.parse(JSON.stringify(defaultOptions))); //使用deep copy, 讓defaultOpt與opt完全獨立
let watchCnt = 0;

// 更新 opt 內容
onMounted(async () => {
    // 讀取 foxinaOpt並更新到opt
    try {
        let { data } = await $q.bex.send('storage.get', { key: 'foxinaOpt' });
        data = JSON.parse(data);
        console.log(`Read opt ${data}`);
        Object.assign(opt, data); // 复制 data 的属性到 opt
    } catch (error) {
        console.error('Error retrieving opt object from storage:', error);
    }
});

// opt 有變動就儲存
watch(opt, async () => {
    if (watchCnt++ == 0) return; //篩選掉第一次載入 foxinaOpt
    await $q.bex.send('storage.set', { key: 'foxinaOpt', value: JSON.stringify(opt) });
    console.log(`opt changed ${opt}`);
});

function openUrlInBrowser(url) {
    chrome.tabs.create({ active: true, url: url });
}
</script>

<style lang="sass" scoped>
.my-card
  width: 100%
</style>
