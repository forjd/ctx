<script setup lang="ts">
import AccountSummary from "~/components/AccountSummary.vue";
import { useAccount } from "~/composables/useAccount";

const account = useAccount();
</script>

<template>
  <AccountSummary :name="account.name" />
</template>
