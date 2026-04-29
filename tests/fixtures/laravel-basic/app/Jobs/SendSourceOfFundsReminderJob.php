<?php

namespace App\Jobs;

use App\Models\SourceOfFundsRequest;

class SendSourceOfFundsReminderJob
{
    public int $tries = 3;

    public function handle(SourceOfFundsRequest $request): void
    {
    }
}
