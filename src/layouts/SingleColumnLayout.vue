<template>
    <div class="optionStyle">
        <q-layout view="hHh lpR fff" container-class="optionStyle">
            <q-header elevated class="bg-primary text-white">
                <q-bar>
                    <img alt="Foxina logo" @dblclick="navigateToIndex" src="~assets/quasar-logo-vertical.svg" style="width: 24px; height: 24px" />
                    <q-toolbar-title>{{ appDescription }}</q-toolbar-title>
                    <div>{{ appVersion }}</div>
                </q-bar>
            </q-header>

            <q-page-container>
                <router-view />
            </q-page-container>
            <!--
            <q-footer elevated class="bg-grey-8 text-white">
                <q-toolbar>
                    <img alt="Foxina logo" src="~assets/quasar-logo-vertical.svg" style="width: 24px; height: 24px" />
                    <div>{{ appVersion }}</div>
                </q-toolbar>
            </q-footer> -->
        </q-layout>
    </div>
</template>

<script setup>
import { ref, reactive, inject } from 'vue';
import { version, description } from '../../package.json';
import { useRouter } from 'vue-router';

const router = useRouter();
const appVersion = version;
const appDescription = description;

// 雙擊Foxina logo時在瀏覽器新窗口打開IndexPage
const navigateToIndex = () => {
    console.log('double click');
    // 使用chrome.tabs.create在瀏覽器窗口打開首頁
    chrome.tabs.create({
        url: chrome.runtime.getURL('www/index.html')
    });
};
</script>

<style scoped>
.optionStyle {
    width: 100%;
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    min-width: 350px;
}
</style>
