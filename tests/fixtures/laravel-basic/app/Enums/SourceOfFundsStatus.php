<?php

namespace App\Enums;

enum SourceOfFundsStatus: string
{
    case Pending = 'pending';
    case Expired = 'expired';
}
