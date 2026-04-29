<?php

namespace App\Jobs;

class SendSourceOfFundsReminderJob
{
    public int $tries = 3;
}
