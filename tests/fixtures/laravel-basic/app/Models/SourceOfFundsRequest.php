<?php

namespace App\Models;

class SourceOfFundsRequest
{
    public string $status;
    public ?string $expires_at = null;
}
