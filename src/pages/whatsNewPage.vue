<template>
    <q-page class="column">
        <q-dialog persistent v-model="showDialog">
            <q-card class="my-card" style="min-width: 450px">
                <q-bar class="bg-primary text-white">
                    <img alt="Foxina logo" src="~assets/quasar-logo-vertical.svg" style="width: 24px; height: 24px" />
                    <q-toolbar-title>{{ appDescription }}</q-toolbar-title>
                    <div>{{ appVersion }}</div>
                </q-bar>
                <q-card-section class="q-pa-xs">
                    <q-carousel v-model="slide" transition-prev="scale" transition-next="scale" swipeable animated infinite control-color="primary" navigation padding arrows height="400px" class="shadow-1 rounded-borders">
                        <q-carousel-slide name="1">
                            <!-- <img src="~assets/popup.png" /> -->

                            <div class="text-h6">注意注意!!</div>
                            <div class="text-subtitle2">富學寶典會抓短時間內上課太多的行為</div>
                            <p style="color: red" class="text-h5">請勿同時撥放多個課程!!</p>
                        </q-carousel-slide>
                        <q-carousel-slide name="2">
                            <img src="~assets/pinFoxina.jpg" />

                            <div class="text-h6">打開 Foxina 按鈕</div>
                            <div class="text-subtitle2">點擊瀏覽器的 "擴充功能" 按鈕，並將 Foxina 按鈕顯示</div>
                        </q-carousel-slide>
                        <q-carousel-slide name="3">
                            <img src="~assets/popup.png" />

                            <div class="text-h6">啟用功能</div>
                            <div class="text-subtitle2">啟用需要狐狸幫你做的事情 (不需要的可以關掉)</div>
                        </q-carousel-slide>
                    </q-carousel>
                </q-card-section>

                <!-- <q-separator /> -->

                <q-card-actions align="right">
                    <q-checkbox dense v-model="doNoShowAgain" label="別再出現了" />
                    <q-space />
                    <q-btn color="primary" dense v-close-popup icon="done" label="明白了" @click="closeDialog" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, onMounted, reactive, inject, watch } from 'vue';
import { useQuasar } from 'quasar';
import { version, description } from '../../package.json';
const appVersion = version;
const appDescription = description;

const $q = useQuasar();
const showDialog = ref(true);
const doNoShowAgain = ref(false);
const slide = ref('1');

const closeDialog = async () => {
    await $q.bex.send('whatsnew.close', {
        doNoShowAgain: doNoShowAgain.value
    });
};
</script>

<style scoped></style>
